const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const DATA_DIR = path.join(__dirname, "..", "data");
const STORE_PATH = path.join(DATA_DIR, "store.json");
const VALID_RATINGS = new Set(["good", "mixed", "bad"]);
const VALID_GEMINI_RATINGS = new Set(["good", "mixed", "bad", "not_used"]);

function currentStorePath() {
  return process.env.KAKAO_SUMMARY_STORE_PATH ? path.resolve(process.env.KAKAO_SUMMARY_STORE_PATH) : STORE_PATH;
}

function currentDataDir() {
  return path.dirname(currentStorePath());
}

function ensureStore() {
  const dataDir = currentDataDir();
  const storePath = currentStorePath();
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  if (!fs.existsSync(storePath)) {
    fs.writeFileSync(storePath, JSON.stringify({ uploads: [], summaries: [], feedbacks: [] }, null, 2), "utf8");
  }
}

function toNumber(value, fallback = 0) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

function normalizeUpload(upload) {
  const systemMessageCount = toNumber(upload.systemMessageCount);
  const mediaMessageCount = toNumber(upload.mediaMessageCount);
  const excludedMessageCount = toNumber(upload.excludedMessageCount, systemMessageCount + mediaMessageCount);

  return {
    id: upload.id || crypto.randomUUID(),
    originalFilename: upload.originalFilename || "unknown.txt",
    uploadedAt: upload.uploadedAt || new Date(0).toISOString(),
    status: upload.status || "unknown",
    detectedDateCount: toNumber(upload.detectedDateCount),
    parsedMessageCount: toNumber(upload.parsedMessageCount),
    skippedLineCount: toNumber(upload.skippedLineCount),
    systemMessageCount,
    mediaMessageCount,
    excludedMessageCount,
    skippedLineSamples: Array.isArray(upload.skippedLineSamples) ? upload.skippedLineSamples.slice(0, 10) : [],
    failedSummaries: Array.isArray(upload.failedSummaries) ? upload.failedSummaries : [],
    summaryIds: Array.isArray(upload.summaryIds) ? upload.summaryIds : [],
    source: upload.source || "web_upload",
    sourcePath: upload.sourcePath || "",
    watchFingerprint: upload.watchFingerprint || ""
  };
}

function normalizeWatchFile(record) {
  return {
    id: record.id || crypto.randomUUID(),
    filename: record.filename || "unknown.txt",
    originalPath: record.originalPath || "",
    finalPath: record.finalPath || "",
    status: record.status || "unknown",
    size: toNumber(record.size),
    mtimeMs: toNumber(record.mtimeMs),
    sha256: record.sha256 || "",
    uploadId: record.uploadId || "",
    summaryCount: toNumber(record.summaryCount),
    detectedDateCount: toNumber(record.detectedDateCount),
    latestSummaryId: record.latestSummaryId || "",
    latestSummaryDate: record.latestSummaryDate || "",
    errorMessage: record.errorMessage || "",
    createdAt: record.createdAt || new Date(0).toISOString(),
    completedAt: record.completedAt || "",
    processedAt: record.processedAt || record.completedAt || ""
  };
}

function normalizeSummaryRow(row) {
  const summary = row.summary || {};
  const date = row.date || summary.date || "unknown-date";
  const topMentions = Array.isArray(row.topMentions) ? row.topMentions : Array.isArray(summary.topMentions) ? summary.topMentions : [];
  const status = row.status || summary.status || "unknown";
  const messageCount = toNumber(row.messageCount, toNumber(summary.messageCount));
  const conclusion = row.conclusion || summary.conclusion || (status === "failed" ? "요약 생성 실패" : "");

  return {
    id: row.id || crypto.randomUUID(),
    uploadId: row.uploadId || summary.uploadId || "unknown-upload",
    date,
    messageCount,
    topMentions,
    conclusion,
    status,
    summary: {
      date,
      messageCount,
      status,
      topMentions,
      conclusion,
      excludedCounts: {
        systemMessageCount: toNumber(summary.excludedCounts?.systemMessageCount),
        mediaMessageCount: toNumber(summary.excludedCounts?.mediaMessageCount)
      },
      sections: summary.sections || {
        marketMood: {
          summary: status === "failed" ? "요약 생성 실패" : "요약 데이터가 없습니다.",
          sentiment: "관망",
          evidence: summary.errorMessage || ""
        },
        topStocks: topMentions,
        stockDetails: [],
        issues: [],
        tradingViews: { buy: [], sell: [], hold: [] },
        risks: [],
        ideas: [],
        conflicts: [],
        nextCheckPoints: [],
        conclusion
      },
      geminiSummary: summary.geminiSummary ?? null,
      errorMessage: summary.errorMessage,
      errorStack: summary.errorStack
    }
  };
}

function normalizeRating(value, allowed = VALID_RATINGS, fallback = "mixed") {
  return allowed.has(value) ? value : fallback;
}

function normalizeFeedback(record) {
  const now = new Date().toISOString();
  return {
    summaryId: record.summaryId || "",
    date: record.date || "",
    overallRating: normalizeRating(record.overallRating),
    tickerRating: normalizeRating(record.tickerRating),
    conclusionRating: normalizeRating(record.conclusionRating),
    checkpointRating: normalizeRating(record.checkpointRating),
    geminiRating: normalizeRating(record.geminiRating, VALID_GEMINI_RATINGS, "not_used"),
    note: String(record.note || "").slice(0, 2000),
    createdAt: record.createdAt || now,
    updatedAt: record.updatedAt || record.createdAt || now
  };
}

function normalizeStore(store) {
  return {
    uploads: Array.isArray(store.uploads) ? store.uploads.map(normalizeUpload) : [],
    summaries: Array.isArray(store.summaries) ? store.summaries.map(normalizeSummaryRow) : [],
    watchFiles: Array.isArray(store.watchFiles) ? store.watchFiles.map(normalizeWatchFile) : [],
    feedbacks: Array.isArray(store.feedbacks) ? store.feedbacks.map(normalizeFeedback) : []
  };
}

function readStore() {
  ensureStore();
  return normalizeStore(JSON.parse(fs.readFileSync(currentStorePath(), "utf8")));
}

function writeStore(store) {
  ensureStore();
  fs.writeFileSync(currentStorePath(), JSON.stringify(store, null, 2), "utf8");
}

function saveUploadResult({ originalFilename, parseResult, dailySummaries, source = "web_upload", sourcePath = "", watchFingerprint = "" }) {
  const store = readStore();
  const uploadId = crypto.randomUUID();
  const uploadedAt = new Date().toISOString();
  const safeStats = parseResult?.stats || {};
  const failedSummaries = dailySummaries.filter((summary) => summary.status === "failed").map((summary) => ({
    date: summary.date,
    errorMessage: summary.errorMessage || "Unknown summary error"
  }));
  const summaryRows = dailySummaries.map((summary) => normalizeSummaryRow({
    id: crypto.randomUUID(),
    uploadId,
    date: summary.date,
    messageCount: toNumber(summary.messageCount),
    topMentions: Array.isArray(summary.topMentions) ? summary.topMentions : [],
    conclusion: summary.conclusion || (summary.status === "failed" ? "요약 생성 실패" : ""),
    status: summary.status || "unknown",
    summary
  }));

  const upload = normalizeUpload({
    id: uploadId,
    originalFilename,
    uploadedAt,
    status: failedSummaries.length ? "completed_with_errors" : summaryRows.length ? "completed" : "failed",
    detectedDateCount: toNumber(safeStats.detectedDateCount),
    parsedMessageCount: toNumber(safeStats.parsedMessageCount),
    skippedLineCount: toNumber(safeStats.skippedLineCount),
    systemMessageCount: toNumber(safeStats.systemMessageCount),
    mediaMessageCount: toNumber(safeStats.mediaMessageCount),
    excludedMessageCount: toNumber(safeStats.excludedMessageCount, toNumber(safeStats.systemMessageCount) + toNumber(safeStats.mediaMessageCount)),
    skippedLineSamples: Array.isArray(parseResult?.skippedLineSamples) ? parseResult.skippedLineSamples.slice(0, 10) : [],
    failedSummaries,
    summaryIds: summaryRows.map((summary) => summary.id),
    source,
    sourcePath,
    watchFingerprint
  });

  store.uploads.unshift(upload);
  store.summaries.unshift(...summaryRows);
  writeStore(store);

  return { upload, summaries: summaryRows };
}

function listUploads() {
  return readStore().uploads;
}

function listSummaries() {
  return readStore().summaries.sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(b.uploadId).localeCompare(String(a.uploadId)));
}

function getUpload(uploadId) {
  return readStore().uploads.find((upload) => upload.id === uploadId) || null;
}

function getSummariesByUpload(uploadId) {
  return readStore().summaries.filter((summary) => summary.uploadId === uploadId).sort((a, b) => String(a.date).localeCompare(String(b.date)));
}

function getSummary(summaryId) {
  return readStore().summaries.find((summary) => summary.id === summaryId) || null;
}

function listWatchFiles() {
  return readStore().watchFiles.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

function hasProcessedWatchFile({ sha256, size }) {
  if (!sha256) return false;
  return readStore().watchFiles.some((record) =>
    record.sha256 === sha256 &&
    (!size || record.size === size) &&
    ["processed", "skipped_duplicate"].includes(record.status)
  );
}

function recordWatchFile(record) {
  const store = readStore();
  const normalized = normalizeWatchFile({
    ...record,
    id: record.id || crypto.randomUUID(),
    createdAt: record.createdAt || new Date().toISOString()
  });
  store.watchFiles.unshift(normalized);
  writeStore(store);
  return normalized;
}

function saveSummaryFeedback(summaryId, feedback) {
  const store = readStore();
  const summary = store.summaries.find((item) => item.id === summaryId);
  if (!summary) throw new Error(`Summary not found: ${summaryId}`);
  const index = store.feedbacks.findIndex((item) => item.summaryId === summaryId);
  const existing = index >= 0 ? store.feedbacks[index] : null;
  const now = new Date().toISOString();
  const normalized = normalizeFeedback({
    ...(existing || {}),
    ...feedback,
    summaryId,
    date: summary.date,
    createdAt: existing?.createdAt || now,
    updatedAt: now
  });
  if (index >= 0) store.feedbacks[index] = normalized;
  else store.feedbacks.unshift(normalized);
  writeStore(store);
  return normalized;
}

function updateSummaryFeedback(summaryId, feedback) {
  return saveSummaryFeedback(summaryId, feedback);
}

function getSummaryFeedback(summaryId) {
  return readStore().feedbacks.find((feedback) => feedback.summaryId === summaryId) || null;
}

function listSummaryFeedback() {
  return readStore().feedbacks.sort((a, b) =>
    String(b.date).localeCompare(String(a.date)) ||
    String(b.updatedAt).localeCompare(String(a.updatedAt))
  );
}

module.exports = {
  DATA_DIR,
  STORE_PATH,
  saveUploadResult,
  listUploads,
  listSummaries,
  getUpload,
  getSummariesByUpload,
  getSummary,
  listWatchFiles,
  hasProcessedWatchFile,
  recordWatchFile,
  saveSummaryFeedback,
  updateSummaryFeedback,
  getSummaryFeedback,
  listSummaryFeedback,
  normalizeFeedback
};
