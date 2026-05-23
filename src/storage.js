const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const DATA_DIR = path.join(__dirname, "..", "data");
const STORE_PATH = path.join(DATA_DIR, "store.json");

function ensureStore() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(STORE_PATH)) {
    fs.writeFileSync(STORE_PATH, JSON.stringify({ uploads: [], summaries: [] }, null, 2), "utf8");
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
    summaryIds: Array.isArray(upload.summaryIds) ? upload.summaryIds : []
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
      errorMessage: summary.errorMessage,
      errorStack: summary.errorStack
    }
  };
}

function normalizeStore(store) {
  return {
    uploads: Array.isArray(store.uploads) ? store.uploads.map(normalizeUpload) : [],
    summaries: Array.isArray(store.summaries) ? store.summaries.map(normalizeSummaryRow) : []
  };
}

function readStore() {
  ensureStore();
  return normalizeStore(JSON.parse(fs.readFileSync(STORE_PATH, "utf8")));
}

function writeStore(store) {
  ensureStore();
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), "utf8");
}

function saveUploadResult({ originalFilename, parseResult, dailySummaries }) {
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
    summaryIds: summaryRows.map((summary) => summary.id)
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

module.exports = {
  DATA_DIR,
  STORE_PATH,
  saveUploadResult,
  listUploads,
  listSummaries,
  getUpload,
  getSummariesByUpload,
  getSummary
};
