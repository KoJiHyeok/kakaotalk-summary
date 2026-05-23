const test = require("node:test");
const assert = require("node:assert/strict");
const {
  addDays,
  getTodaySummaryStatus,
  getRecentSevenDayStatus
} = require("../src/dailyStatus");

test("today summary status detects an existing summary and watch filename", () => {
  const status = getTodaySummaryStatus({
    today: new Date(2026, 4, 23, 9, 0, 0),
    summaries: [
      { id: "summary-today", date: "2026-05-23" },
      { id: "summary-yesterday", date: "2026-05-22" }
    ],
    watchRecords: [
      {
        filename: "KakaoTalk_20260523_group.txt",
        status: "processed",
        latestSummaryDate: "2026-05-23",
        latestSummaryId: "summary-today",
        processedAt: "2026-05-23T08:30:00.000Z"
      }
    ]
  });

  assert.equal(status.date, "2026-05-23");
  assert.equal(status.hasSummary, true);
  assert.equal(status.summaryId, "summary-today");
  assert.equal(status.filename, "KakaoTalk_20260523_group.txt");
});

test("today summary status reports missing when no summary exists", () => {
  const status = getTodaySummaryStatus({
    today: new Date(2026, 4, 23, 9, 0, 0),
    summaries: [{ id: "summary-yesterday", date: "2026-05-22" }],
    watchRecords: []
  });

  assert.equal(status.date, "2026-05-23");
  assert.equal(status.hasSummary, false);
  assert.equal(status.summaryId, "");
  assert.equal(status.status, "missing");
});

test("recent seven day status includes today and links processed dates", () => {
  const items = getRecentSevenDayStatus({
    today: new Date(2026, 4, 23, 9, 0, 0),
    summaries: [
      { id: "summary-23", date: "2026-05-23" },
      { id: "summary-20", date: "2026-05-20" }
    ]
  });

  assert.equal(items.length, 7);
  assert.deepEqual(items.map((item) => item.date), [
    "2026-05-23",
    "2026-05-22",
    "2026-05-21",
    "2026-05-20",
    "2026-05-19",
    "2026-05-18",
    "2026-05-17"
  ]);
  assert.equal(items[0].hasSummary, true);
  assert.equal(items[0].summaryId, "summary-23");
  assert.equal(items[3].hasSummary, true);
  assert.equal(items[3].summaryId, "summary-20");
  assert.equal(items[1].hasSummary, false);
});

test("addDays handles month boundaries", () => {
  assert.equal(addDays("2026-06-01", -1), "2026-05-31");
});
