const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const crypto = require("crypto");
const { execFile } = require("child_process");
const { processTxtContent } = require("./processor");
const storage = require("./storage");

const WATCH_DIR = path.join(__dirname, "..", "watch");
const PROCESSED_DIR = path.join(WATCH_DIR, "processed");
const FAILED_DIR = path.join(WATCH_DIR, "failed");
const DEFAULT_INTERVAL_MS = 5000;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function appBaseUrl(env = process.env) {
  return env.APP_BASE_URL || `http://localhost:${env.PORT || 3000}`;
}

function shouldOpenSummaryAfterWatch(env = process.env) {
  return String(env.OPEN_SUMMARY_AFTER_WATCH || "false").toLowerCase() === "true";
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

function latestSummaryInfo(summaries) {
  const items = Array.isArray(summaries) ? summaries.filter((summary) => summary?.id && summary?.date) : [];
  if (!items.length) return { latestSummaryId: "", latestSummaryDate: "" };
  const latest = items.slice().sort((a, b) => String(b.date).localeCompare(String(a.date)))[0];
  return { latestSummaryId: latest.id, latestSummaryDate: latest.date };
}

function buildProcessedWatchRecord({ filename, filePath, finalPath, fingerprint, saved, startedAt, processedAt }) {
  const latest = latestSummaryInfo(saved?.summaries || []);
  return {
    filename,
    originalPath: filePath,
    finalPath,
    status: "processed",
    size: fingerprint.size,
    mtimeMs: fingerprint.mtimeMs,
    sha256: fingerprint.sha256,
    uploadId: saved.upload.id,
    detectedDateCount: saved.upload.detectedDateCount || 0,
    summaryCount: Array.isArray(saved.summaries) ? saved.summaries.length : 0,
    latestSummaryId: latest.latestSummaryId,
    latestSummaryDate: latest.latestSummaryDate,
    createdAt: startedAt,
    completedAt: processedAt,
    processedAt
  };
}

function buildDuplicateWatchRecord({ filename, filePath, finalPath, fingerprint, startedAt, processedAt }) {
  return {
    filename,
    originalPath: filePath,
    finalPath,
    status: "skipped_duplicate",
    size: fingerprint.size,
    mtimeMs: fingerprint.mtimeMs,
    sha256: fingerprint.sha256,
    errorMessage: "이미 처리한 파일과 동일한 해시입니다.",
    createdAt: startedAt,
    completedAt: processedAt,
    processedAt
  };
}

function openUrlInBrowser(url, logger = console) {
  return new Promise((resolve) => {
    const platform = process.platform;
    const command = platform === "win32" ? "cmd" : platform === "darwin" ? "open" : "xdg-open";
    const args = platform === "win32" ? ["/c", "start", "", url] : [url];
    execFile(command, args, { windowsHide: true }, (error) => {
      if (error) logger.warn?.("[watch] failed to open browser", error.message || String(error));
      resolve(!error);
    });
  });
}

async function maybeOpenLatestSummary(record, { env = process.env, logger = console, opener = openUrlInBrowser } = {}) {
  if (!shouldOpenSummaryAfterWatch(env) || !record?.latestSummaryId) return false;
  const url = `${appBaseUrl(env)}/summaries/${record.latestSummaryId}`;
  try {
    return await opener(url, logger);
  } catch (error) {
    logger.warn?.("[watch] failed to open latest summary", error?.message || String(error));
    return false;
  }
}

function logWatchSuccess(record, logger = console, env = process.env) {
  const url = record.latestSummaryId ? `${appBaseUrl(env)}/summaries/${record.latestSummaryId}` : "";
  logger.log?.(`✅ Watch 처리 완료: ${record.filename}`);
  logger.log?.(`📅 생성된 요약: ${record.summaryCount || 0}개`);
  if (url) logger.log?.(`🔗 최신 요약: ${url}`);
}

function normalizeProcessOptions(loggerOrOptions) {
  if (!loggerOrOptions || typeof loggerOrOptions.error === "function" || typeof loggerOrOptions.log === "function") {
    return { logger: loggerOrOptions || console };
  }
  return { logger: console, ...loggerOrOptions };
}

async function processWatchFile(filePath, loggerOrOptions = console) {
  const options = normalizeProcessOptions(loggerOrOptions);
  const logger = options.logger || console;
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
      return storage.recordWatchFile(buildDuplicateWatchRecord({
        filename,
        filePath,
        finalPath,
        fingerprint,
        startedAt,
        processedAt: new Date().toISOString()
      }));
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
    const record = storage.recordWatchFile(buildProcessedWatchRecord({
      filename,
      filePath,
      finalPath,
      fingerprint,
      saved,
      startedAt,
      processedAt: new Date().toISOString()
    }));

    logWatchSuccess(record, logger, options.env || process.env);
    await maybeOpenLatestSummary(record, {
      env: options.env || process.env,
      logger,
      opener: options.opener || openUrlInBrowser
    });
    return record;
  } catch (error) {
    let finalPath = "";
    try {
      if (fs.existsSync(filePath)) finalPath = await moveFile(filePath, FAILED_DIR);
    } catch (moveError) {
      logger.error?.("[watch] failed to move failed file", moveError);
    }
    logger.error?.("[watch] file processing failed", { filename, message: error?.message || String(error), stack: error?.stack });
    const processedAt = new Date().toISOString();
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
      completedAt: processedAt,
      processedAt
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
          await processWatchFile(filePath, { logger });
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
  const records = storage.listWatchFiles().map((record) => {
    if (!record.uploadId) return record;
    const upload = storage.getUpload(record.uploadId) || {};
    const summaries = storage.getSummariesByUpload(record.uploadId);
    const latest = record.latestSummaryId ? {
      latestSummaryId: record.latestSummaryId,
      latestSummaryDate: record.latestSummaryDate
    } : latestSummaryInfo(summaries);
    return {
      ...record,
      detectedDateCount: record.detectedDateCount || upload.detectedDateCount || 0,
      summaryCount: record.summaryCount || summaries.length || upload.summaryIds?.length || 0,
      latestSummaryId: latest.latestSummaryId,
      latestSummaryDate: latest.latestSummaryDate,
      processedAt: record.processedAt || record.completedAt || record.createdAt || ""
    };
  });
  const processedCount = records.filter((record) => record.status === "processed").length;
  const failedCount = records.filter((record) => record.status === "failed").length;
  const duplicateCount = records.filter((record) => record.status === "skipped_duplicate").length;
  const lastRecord = records.find((record) => record.processedAt || record.completedAt || record.createdAt) || null;
  return {
    watchDir: WATCH_DIR,
    processedDir: PROCESSED_DIR,
    failedDir: FAILED_DIR,
    processedCount,
    failedCount,
    duplicateCount,
    lastProcessedAt: lastRecord?.processedAt || lastRecord?.completedAt || lastRecord?.createdAt || "",
    latestRecord: lastRecord,
    recent: records.slice(0, 20)
  };
}

module.exports = {
  WATCH_DIR,
  PROCESSED_DIR,
  FAILED_DIR,
  appBaseUrl,
  shouldOpenSummaryAfterWatch,
  latestSummaryInfo,
  buildProcessedWatchRecord,
  buildDuplicateWatchRecord,
  maybeOpenLatestSummary,
  ensureWatchFolders,
  processWatchFile,
  createWatchScanner,
  startWatchFolder,
  getWatchStatus
};
