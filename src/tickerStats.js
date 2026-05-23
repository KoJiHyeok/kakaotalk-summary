const { categorizeTicker, extractTickers, KOREAN_STOCK_ALIASES } = require("./analyzer");

const EXTRA_ALIAS_MAP = {
  엔비: "NVDA",
  엔비디아: "NVDA",
  코베: "COIN",
  코인: "COIN",
  코인베이스: "COIN",
  비트: "BTC",
  비트코인: "BTC",
  속슬: "SOXL",
  쏙스: "SOXS",
  팔랑이: "PLTR",
  팔란티어: "PLTR",
  온큐: "IONQ",
  아이온큐: "IONQ",
  아온큐: "IONQ",
  샌디: "SNDK",
  샌디스크: "SNDK"
};

function normalizeTickerQuery(query) {
  const text = String(query || "").trim();
  if (!text) return "";
  const aliasTicker = EXTRA_ALIAS_MAP[text] || KOREAN_STOCK_ALIASES[text];
  if (aliasTicker) return String(aliasTicker).toUpperCase();
  const extracted = extractTickers(text);
  if (extracted.length) return extracted[0];
  return text.replace(/[^A-Za-z0-9.-]/g, "").toUpperCase();
}

function rowTimestamp(row, uploadsById, fallbackIndex) {
  const upload = uploadsById.get(row?.uploadId);
  const parsed = Date.parse(upload?.uploadedAt || row?.uploadedAt || row?.createdAt || "");
  if (Number.isFinite(parsed)) return parsed;
  return -fallbackIndex;
}

function latestSummariesByDate(summaries, uploads = []) {
  const uploadsById = new Map((Array.isArray(uploads) ? uploads : []).map((upload) => [upload.id, upload]));
  const latestByDate = new Map();
  (Array.isArray(summaries) ? summaries : []).forEach((row, index) => {
    if (!row?.date) return;
    const timestamp = rowTimestamp(row, uploadsById, index);
    const current = latestByDate.get(row.date);
    if (!current || timestamp > current.timestamp) latestByDate.set(row.date, { row, timestamp });
  });
  return Array.from(latestByDate.values())
    .map((entry) => entry.row)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
}

function topMentionsForRow(row) {
  if (Array.isArray(row?.topMentions)) return row.topMentions;
  if (Array.isArray(row?.summary?.topMentions)) return row.summary.topMentions;
  return [];
}

function buildTickerStats(summaries, options = {}) {
  const latestRows = latestSummariesByDate(summaries, options.uploads || []);
  const statsByTicker = new Map();

  latestRows.forEach((row) => {
    topMentionsForRow(row).forEach((mention) => {
      const ticker = normalizeTickerQuery(mention?.ticker);
      if (!ticker) return;
      const count = Number(mention?.count || 0);
      if (!Number.isFinite(count) || count <= 0) return;
      if (!statsByTicker.has(ticker)) {
        statsByTicker.set(ticker, {
          ticker,
          category: mention.category || categorizeTicker(ticker),
          totalCount: 0,
          dateCount: 0,
          recentDate: "",
          dates: []
        });
      }
      const stat = statsByTicker.get(ticker);
      stat.totalCount += count;
      stat.category = stat.category || mention.category || categorizeTicker(ticker);
      stat.recentDate = !stat.recentDate || String(row.date).localeCompare(stat.recentDate) > 0 ? row.date : stat.recentDate;
      stat.dates.push({
        date: row.date,
        count,
        sentiment: mention.sentiment || "",
        reason: mention.reason || mention.keyPoints?.[0] || "",
        conclusion: row.conclusion || row.summary?.conclusion || "",
        summaryId: row.id || ""
      });
    });
  });

  return Array.from(statsByTicker.values())
    .map((stat) => ({
      ...stat,
      dateCount: stat.dates.length,
      dates: stat.dates.sort((a, b) => String(a.date).localeCompare(String(b.date)))
    }))
    .sort((a, b) => b.totalCount - a.totalCount || a.ticker.localeCompare(b.ticker));
}

function findTickerStats(summaries, tickerOrAlias, options = {}) {
  const ticker = normalizeTickerQuery(tickerOrAlias);
  if (!ticker) return null;
  return buildTickerStats(summaries, options).find((stat) => stat.ticker === ticker) || null;
}

module.exports = {
  buildTickerStats,
  findTickerStats,
  normalizeTickerQuery,
  latestSummariesByDate
};
