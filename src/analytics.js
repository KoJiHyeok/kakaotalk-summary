const { buildTickerStats, latestSummariesByDate } = require("./tickerStats");

function uploadMap(uploads = []) {
  return new Map((Array.isArray(uploads) ? uploads : []).map((upload) => [upload.id, upload]));
}

function latestRows(summaries = [], uploads = []) {
  return latestSummariesByDate(summaries, uploads);
}

function numberValue(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function excludedCount(row) {
  const counts = row?.summary?.excludedCounts || {};
  return numberValue(counts.systemMessageCount) + numberValue(counts.mediaMessageCount);
}

function skippedLineCount(row, uploadsById) {
  const upload = uploadsById.get(row?.uploadId);
  return numberValue(row?.summary?.skippedLineCount ?? row?.skippedLineCount ?? upload?.skippedLineCount);
}

function uniqueLatestUploads(rows) {
  return Array.from(new Set(rows.map((row) => row.uploadId).filter(Boolean)));
}

function topMentions(row, limit = 3) {
  const mentions = Array.isArray(row?.topMentions)
    ? row.topMentions
    : Array.isArray(row?.summary?.topMentions)
      ? row.summary.topMentions
      : [];
  return mentions.slice(0, limit).map((item) => ({
    ticker: item.ticker || "",
    category: item.category || "unknown",
    count: numberValue(item.count),
    sentiment: item.sentiment || "",
    reason: item.reason || ""
  }));
}

function marketMood(row) {
  return row?.summary?.sections?.marketMood?.sentiment ||
    row?.summary?.marketMood ||
    row?.summary?.roomSentiment ||
    "정보 없음";
}

function geminiState(row) {
  const gemini = row?.summary?.geminiSummary;
  if (!gemini) return { status: "none", label: "Gemini 없음", error: "", model: "", generatedAt: "" };
  if (gemini.failed) {
    return {
      status: "failed",
      label: "Gemini 실패",
      error: gemini.error || gemini.rawText || "",
      model: gemini.model || "",
      generatedAt: gemini.generatedAt || ""
    };
  }
  return {
    status: "generated",
    label: "Gemini 있음",
    error: "",
    model: gemini.model || "",
    generatedAt: gemini.generatedAt || ""
  };
}

function buildAnalyticsSummary(summaries = [], options = {}) {
  const uploads = options.uploads || [];
  const rows = latestRows(summaries, uploads);
  const uploadsById = uploadMap(uploads);
  const latestUploadIds = uniqueLatestUploads(rows);
  const totalSkippedLineCount = latestUploadIds.reduce((sum, uploadId) => {
    return sum + numberValue(uploadsById.get(uploadId)?.skippedLineCount);
  }, 0);
  const busiest = rows.slice().sort((a, b) => numberValue(b.messageCount) - numberValue(a.messageCount))[0] || null;
  const topTicker = buildTickerStats(rows, { uploads })[0] || null;

  return {
    dateCount: rows.length,
    totalMessageCount: rows.reduce((sum, row) => sum + numberValue(row.messageCount), 0),
    totalExcludedMessageCount: rows.reduce((sum, row) => sum + excludedCount(row), 0),
    totalSkippedLineCount,
    geminiGeneratedDateCount: rows.filter((row) => geminiState(row).status === "generated").length,
    busiestDate: busiest ? {
      date: busiest.date,
      messageCount: numberValue(busiest.messageCount),
      summaryId: busiest.id || ""
    } : null,
    topMention: topTicker ? {
      ticker: topTicker.ticker,
      category: topTicker.category,
      totalCount: topTicker.totalCount,
      dateCount: topTicker.dateCount,
      recentDate: topTicker.recentDate
    } : null
  };
}

function buildDailyMessageSeries(summaries = [], options = {}) {
  const uploads = options.uploads || [];
  const uploadsById = uploadMap(uploads);
  return latestRows(summaries, uploads).map((row) => ({
    date: row.date,
    summaryId: row.id || "",
    messageCount: numberValue(row.messageCount),
    excludedMessageCount: excludedCount(row),
    skippedLineCount: skippedLineCount(row, uploadsById)
  }));
}

function buildMarketMoodTable(summaries = [], options = {}) {
  return latestRows(summaries, options.uploads || []).map((row) => ({
    date: row.date,
    summaryId: row.id || "",
    mood: marketMood(row),
    conclusion: row.conclusion || row.summary?.conclusion || "",
    topMentions: topMentions(row, 3)
  }));
}

function buildDailyTopMentions(summaries = [], options = {}) {
  return latestRows(summaries, options.uploads || []).map((row) => ({
    date: row.date,
    summaryId: row.id || "",
    topMentions: topMentions(row, 3)
  }));
}

function buildGeminiStatusTable(summaries = [], options = {}) {
  return latestRows(summaries, options.uploads || []).map((row) => ({
    date: row.date,
    summaryId: row.id || "",
    ...geminiState(row)
  }));
}

module.exports = {
  buildAnalyticsSummary,
  buildDailyMessageSeries,
  buildMarketMoodTable,
  buildDailyTopMentions,
  buildGeminiStatusTable
};
