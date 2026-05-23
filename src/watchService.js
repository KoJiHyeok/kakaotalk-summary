const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const crypto = require("crypto");
const { processTxtContent } = require("./processor");
const storage = require("./storage");

const WATCH_DIR = path.join(__dirname, "..", "watch");
const PROCESSED_DIR = path.join(WATCH_DIR, "processed");
const FAILED_DIR = path.join(WATCH_DIR, "failed");
const DEFAULT_INTERVAL_MS = 5000;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function ensureWatchFolders() {
  await fsp.mkdir(PROCESSED_DIR, { recursive: true });
  await fsp.mkdir(FAILED_DIR, { recursive: true });
}

async function isStableFile(filePath) {
  const first = await fsp.stat(filePath);
  await delay(600);
  const second = await fsp.stat(filePath);
  return first.size === second.size && first.mtimeMs === second.mtimeMs;
}

async function fingerprintFile(filePath) {
  const [buffer, stat] = await Promise.all([fsp.readFile(filePath), fsp.stat(filePath)]);
  return {
    size: stat.size,
    mtimeMs: stat.mtimeMs,
    sha256: crypto.createHash("sha256").update(buffer).digest("hex"),
    content: buffer.toString("utf8")
  };
}

async function uniqueDestination(dir, filename) {
  const parsed = path.parse(filename);
  let candidate = path.join(dir, filename);
  let index = 1;
  while (fs.existsSync(candidate)) {
    candidate = path.join(dir, `${parsed.name}-${Date.now()}-${index}${parsed.ext}`);
    index += 1;
  }
  return candidate;
}

async function moveFile(filePath, dir) {
  await fsp.mkdir(dir, { recursive: true });
  const destination = await uniqueDestination(dir, path.basename(filePath));
  try {
    await fsp.rename(filePath, destination);
  } catch (error) {
    if (error.code !== "EXDEV") throw error;
    await fsp.copyFile(filePath, destination);
    await fsp.unlink(filePath);
  }
  return destination;
}

async function processWatchFile(filePath, logger = console) {
  const filename = path.basename(filePath);
  const startedAt = new Date().toISOString();
  let fingerprint = { size: 0, mtimeMs: 0, sha256: "" };

  try {
    if (!filename.toLowerCase().endsWith(".txt")) return null;
    if (!(await isStableFile(filePath))) return null;

    fingerprint = await fingerprintFile(filePath);
    const watchFingerprint = `${fingerprint.sha256}:${fingerprint.size}`;

    if (storage.hasProcessedWatchFile(fingerprint)) {
      const finalPath = await moveFile(filePath, PROCESSED_DIR);
      return storage.recordWatchFile({
        filename,
        originalPath: filePath,
        finalPath,
        status: "skipped_duplicate",
        size: fingerprint.size,
        mtimeMs: fingerprint.mtimeMs,
        sha256: fingerprint.sha256,
        errorMessage: "이미 처리한 파일과 동일한 해시입니다.",
        createdAt: startedAt,
        completedAt: new Date().toISOString()
      });
    }

    const saved = await processTxtContent({
      content: fingerprint.content,
      originalFilename: filename,
      source: "watch_folder",
      sourcePath: filePath,
      watchFingerprint,
      onDailyError: (error, context) => {
        logger.error?.("[watch] daily summary failed", { filename, ...context, message: error?.message || String(error) });
      }
    });
    const finalPath = await moveFile(filePath, PROCESSED_DIR);

    return storage.recordWatchFile({
      filename,
      originalPath: filePath,
      finalPath,
      status: "processed",
      size: fingerprint.size,
      mtimeMs: fingerprint.mtimeMs,
      sha256: fingerprint.sha256,
      uploadId: saved.upload.id,
      summaryCount: saved.summaries.length,
      createdAt: startedAt,
      completedAt: new Date().toISOString()
    });
  } catch (error) {
    let finalPath = "";
    try {
      if (fs.existsSync(filePath)) finalPath = await moveFile(filePath, FAILED_DIR);
    } catch (moveError) {
      logger.error?.("[watch] failed to move failed file", moveError);
    }
    logger.error?.("[watch] file processing failed", { filename, message: error?.message || String(error), stack: error?.stack });
    return storage.recordWatchFile({
      filename,
      originalPath: filePath,
      finalPath,
      status: "failed",
      size: fingerprint.size,
      mtimeMs: fingerprint.mtimeMs,
      sha256: fingerprint.sha256,
      errorMessage: error?.message || String(error),
      createdAt: startedAt,
      completedAt: new Date().toISOString()
    });
  }
}

function createWatchScanner({ intervalMs = DEFAULT_INTERVAL_MS, logger = console } = {}) {
  const active = new Set();
  let scanning = false;
  let timer = null;

  async function scan() {
    if (scanning) return;
    scanning = true;
    try {
      await ensureWatchFolders();
      const entries = await fsp.readdir(WATCH_DIR, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isFile() || !entry.name.toLowerCase().endsWith(".txt")) continue;
        const filePath = path.join(WATCH_DIR, entry.name);
        if (active.has(filePath)) continue;
        active.add(filePath);
        try {
          await processWatchFile(filePath, logger);
        } finally {
          active.delete(filePath);
        }
      }
    } catch (error) {
      logger.error?.("[watch] scan failed", error);
    } finally {
      scanning = false;
    }
  }

  return {
    scan,
    start() {
      scan();
      timer = setInterval(scan, intervalMs);
      return this;
    },
    stop() {
      if (timer) clearInterval(timer);
      timer = null;
    }
  };
}

function startWatchFolder(options = {}) {
  return createWatchScanner(options).start();
}

function getWatchStatus() {
  const records = storage.listWatchFiles();
  const processedCount = records.filter((record) => record.status === "processed").length;
  const failedCount = records.filter((record) => record.status === "failed").length;
  const duplicateCount = records.filter((record) => record.status === "skipped_duplicate").length;
  const lastRecord = records.find((record) => record.completedAt || record.createdAt);
  return {
    watchDir: WATCH_DIR,
    processedDir: PROCESSED_DIR,
    failedDir: FAILED_DIR,
    processedCount,
    failedCount,
    duplicateCount,
    lastProcessedAt: lastRecord?.completedAt || lastRecord?.createdAt || "",
    recent: records.slice(0, 20)
  };
}

module.exports = {
  WATCH_DIR,
  PROCESSED_DIR,
  FAILED_DIR,
  ensureWatchFolders,
  processWatchFile,
  createWatchScanner,
  startWatchFolder,
  getWatchStatus
};
