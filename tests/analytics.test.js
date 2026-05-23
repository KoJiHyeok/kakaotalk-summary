const test = require("node:test");
const assert = require("node:assert/strict");
const {
  buildAnalyticsSummary,
  buildDailyMessageSeries,
  buildMarketMoodTable,
  buildGeminiStatusTable
} = require("../src/analytics");

const summaries = [
  {
    id: "summary-1",
    uploadId: "upload-1",
    date: "2026-05-20",
    messageCount: 100,
    conclusion: "NVDA 실적 기대가 언급되었습니다.",
    topMentions: [
      { ticker: "NVDA", category: "stock", count: 10 },
      { ticker: "SOXL", category: "etf", count: 5 },
      { ticker: "BTC", category: "crypto", count: 3 }
    ],
    summary: {
      excludedCounts: { systemMessageCount: 2, mediaMessageCount: 3 },
      sections: { marketMood: { sentiment: "상승" } },
      geminiSummary: { model: "gemini-2.5-flash", generatedAt: "2026-05-20T01:00:00.000Z" }
    }
  },
  {
    id: "summary-2",
    uploadId: "upload-2",
    date: "2026-05-21",
    messageCount: 230,
    conclusion: "COIN과 BTC 흐름이 언급되었습니다.",
    topMentions: [
      { ticker: "COIN", category: "stock", count: 20 },
      { ticker: "BTC", category: "crypto", count: 12 }
    ],
    summary: {
      excludedCounts: { systemMessageCount: 1, mediaMessageCount: 4 },
      sections: { marketMood: { sentiment: "혼조" } },
      geminiSummary: null
    }
  },
  {
    id: "summary-3",
    uploadId: "upload-3",
    date: "2026-05-22",
    messageCount: 80,
    conclusion: "Gemini 실패 예시입니다.",
    topMentions: [{ ticker: "NVDA", category: "stock", count: 2 }],
    summary: {
      excludedCounts: { systemMessageCount: 0, mediaMessageCount: 1 },
      sections: { marketMood: { sentiment: "관망" } },
      geminiSummary: { failed: true, error: "quota exceeded" }
    }
  }
];

const uploads = [
  { id: "upload-1", uploadedAt: "2026-05-20T01:00:00.000Z", skippedLineCount: 1 },
  { id: "upload-2", uploadedAt: "2026-05-21T01:00:00.000Z", skippedLineCount: 2 },
  { id: "upload-3", uploadedAt: "2026-05-22T01:00:00.000Z", skippedLineCount: 3 }
];

test("analytics summary calculates total message counts", () => {
  const result = buildAnalyticsSummary(summaries, { uploads });

  assert.equal(result.dateCount, 3);
  assert.equal(result.totalMessageCount, 410);
  assert.equal(result.totalExcludedMessageCount, 11);
  assert.equal(result.totalSkippedLineCount, 6);
});

test("analytics summary finds busiest date and top ticker", () => {
  const result = buildAnalyticsSummary(summaries, { uploads });

  assert.equal(result.busiestDate.date, "2026-05-21");
  assert.equal(result.busiestDate.messageCount, 230);
  assert.equal(result.topMention.ticker, "COIN");
});

test("gemini status table separates generated none and failed states", () => {
  const table = buildGeminiStatusTable(summaries, { uploads });

  assert.deepEqual(table.map((row) => row.status), ["generated", "none", "failed"]);
  assert.equal(table[2].error, "quota exceeded");
});

test("market mood table extracts top three mentions", () => {
  const table = buildMarketMoodTable(summaries, { uploads });

  assert.equal(table[0].mood, "상승");
  assert.deepEqual(table[0].topMentions.map((item) => item.ticker), ["NVDA", "SOXL", "BTC"]);
});

test("analytics functions handle empty summaries safely", () => {
  assert.deepEqual(buildDailyMessageSeries([], { uploads: [] }), []);
  assert.deepEqual(buildMarketMoodTable([], { uploads: [] }), []);
  assert.deepEqual(buildGeminiStatusTable([], { uploads: [] }), []);
  assert.equal(buildAnalyticsSummary([], { uploads: [] }).dateCount, 0);
});

test("same-date duplicate summaries use the latest upload only", () => {
  const duplicateSummaries = [
    {
      id: "old-summary",
      uploadId: "old-upload",
      date: "2026-05-23",
      messageCount: 500,
      topMentions: [{ ticker: "NVDA", category: "stock", count: 100 }],
      summary: { excludedCounts: { systemMessageCount: 0, mediaMessageCount: 0 }, geminiSummary: null }
    },
    {
      id: "new-summary",
      uploadId: "new-upload",
      date: "2026-05-23",
      messageCount: 50,
      topMentions: [{ ticker: "COIN", category: "stock", count: 9 }],
      summary: { excludedCounts: { systemMessageCount: 1, mediaMessageCount: 1 }, geminiSummary: null }
    }
  ];
  const duplicateUploads = [
    { id: "old-upload", uploadedAt: "2026-05-23T01:00:00.000Z", skippedLineCount: 7 },
    { id: "new-upload", uploadedAt: "2026-05-23T02:00:00.000Z", skippedLineCount: 2 }
  ];

  const result = buildAnalyticsSummary(duplicateSummaries, { uploads: duplicateUploads });

  assert.equal(result.dateCount, 1);
  assert.equal(result.totalMessageCount, 50);
  assert.equal(result.topMention.ticker, "COIN");
  assert.equal(result.totalSkippedLineCount, 2);
});
