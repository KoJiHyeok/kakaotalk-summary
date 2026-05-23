const test = require("node:test");
const assert = require("node:assert/strict");
const {
  buildTickerStats,
  findTickerStats,
  normalizeTickerQuery
} = require("../src/tickerStats");

const summaries = [
  {
    id: "summary-1",
    uploadId: "upload-1",
    date: "2026-05-20",
    conclusion: "엔비디아 실적 기대가 언급되었습니다.",
    topMentions: [
      { ticker: "NVDA", category: "stock", count: 10, sentiment: "상승", reason: "실적 기대" },
      { ticker: "SOXL", category: "etf", count: 3, sentiment: "혼조", reason: "레버리지 대응" }
    ]
  },
  {
    id: "summary-2",
    uploadId: "upload-2",
    date: "2026-05-21",
    conclusion: "코인과 비트 흐름이 언급되었습니다.",
    topMentions: [
      { ticker: "NVDA", category: "stock", count: 5, sentiment: "관망", reason: "주가 정체" },
      { ticker: "BTC", category: "crypto", count: 7, sentiment: "상승", reason: "80k 돌파 관심" }
    ]
  }
];

test("buildTickerStats calculates total counts by ticker", () => {
  const stats = buildTickerStats(summaries);
  const nvda = stats.find((item) => item.ticker === "NVDA");

  assert.equal(nvda.totalCount, 15);
  assert.equal(nvda.dateCount, 2);
  assert.equal(nvda.category, "stock");
});

test("buildTickerStats keeps date series in ascending order", () => {
  const nvda = findTickerStats(summaries, "NVDA");

  assert.deepEqual(nvda.dates.map((item) => item.date), ["2026-05-20", "2026-05-21"]);
  assert.deepEqual(nvda.dates.map((item) => item.count), [10, 5]);
});

test("buildTickerStats preserves category and recent mention date", () => {
  const btc = findTickerStats(summaries, "BTC");

  assert.equal(btc.category, "crypto");
  assert.equal(btc.recentDate, "2026-05-21");
  assert.equal(btc.totalCount, 7);
});

test("normalizeTickerQuery supports Korean aliases", () => {
  assert.equal(normalizeTickerQuery("엔비"), "NVDA");
  assert.equal(findTickerStats(summaries, "엔비").ticker, "NVDA");
});

test("findTickerStats returns null for unknown ticker", () => {
  assert.equal(findTickerStats(summaries, "UNKNOWN"), null);
});

test("same-date duplicate summaries use the latest upload only", () => {
  const duplicateSummaries = [
    {
      id: "old-summary",
      uploadId: "old-upload",
      date: "2026-05-22",
      topMentions: [{ ticker: "COIN", category: "stock", count: 100 }]
    },
    {
      id: "new-summary",
      uploadId: "new-upload",
      date: "2026-05-22",
      topMentions: [{ ticker: "COIN", category: "stock", count: 9 }]
    }
  ];
  const uploads = [
    { id: "old-upload", uploadedAt: "2026-05-22T01:00:00.000Z" },
    { id: "new-upload", uploadedAt: "2026-05-22T03:00:00.000Z" }
  ];

  const coin = findTickerStats(duplicateSummaries, "COIN", { uploads });

  assert.equal(coin.totalCount, 9);
  assert.equal(coin.dates[0].summaryId, "new-summary");
});
