const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const storage = require("../src/storage");

const previousStorePath = process.env.KAKAO_SUMMARY_STORE_PATH;
let tempDir = "";

function seedStore(extra = {}) {
  fs.writeFileSync(process.env.KAKAO_SUMMARY_STORE_PATH, JSON.stringify({
    uploads: [],
    summaries: [
      {
        id: "summary-1",
        uploadId: "upload-1",
        date: "2026-05-23",
        messageCount: 10,
        topMentions: [],
        conclusion: "테스트 요약",
        status: "completed",
        summary: {
          date: "2026-05-23",
          messageCount: 10,
          status: "completed",
          topMentions: [],
          conclusion: "테스트 요약",
          excludedCounts: { systemMessageCount: 0, mediaMessageCount: 0 },
          sections: {}
        }
      }
    ],
    watchFiles: [],
    ...extra
  }, null, 2), "utf8");
}

test.beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "kakao-feedback-"));
  process.env.KAKAO_SUMMARY_STORE_PATH = path.join(tempDir, "store.json");
  seedStore();
});

test.afterEach(() => {
  if (previousStorePath === undefined) delete process.env.KAKAO_SUMMARY_STORE_PATH;
  else process.env.KAKAO_SUMMARY_STORE_PATH = previousStorePath;
});

test("saves new summary feedback", () => {
  const feedback = storage.saveSummaryFeedback("summary-1", {
    overallRating: "good",
    tickerRating: "mixed",
    conclusionRating: "good",
    checkpointRating: "bad",
    geminiRating: "not_used",
    note: "핵심 종목은 좋고 체크포인트는 보완 필요"
  });

  assert.equal(feedback.summaryId, "summary-1");
  assert.equal(feedback.date, "2026-05-23");
  assert.equal(feedback.overallRating, "good");
  assert.match(feedback.note, /체크포인트/);
  assert.equal(storage.getSummaryFeedback("summary-1").overallRating, "good");
});

test("updates existing feedback for the same summaryId", () => {
  const first = storage.saveSummaryFeedback("summary-1", {
    overallRating: "good",
    tickerRating: "good",
    conclusionRating: "good",
    checkpointRating: "good",
    geminiRating: "good",
    note: "first"
  });
  const second = storage.updateSummaryFeedback("summary-1", {
    overallRating: "bad",
    tickerRating: "mixed",
    conclusionRating: "bad",
    checkpointRating: "mixed",
    geminiRating: "not_used",
    note: "second"
  });

  assert.equal(second.createdAt, first.createdAt);
  assert.equal(second.overallRating, "bad");
  assert.equal(storage.listSummaryFeedback().length, 1);
});

test("lists feedback rows", () => {
  storage.saveSummaryFeedback("summary-1", {
    overallRating: "mixed",
    tickerRating: "good",
    conclusionRating: "mixed",
    checkpointRating: "bad",
    geminiRating: "not_used",
    note: "목록 테스트"
  });

  const rows = storage.listSummaryFeedback();

  assert.equal(rows.length, 1);
  assert.equal(rows[0].summaryId, "summary-1");
});

test("store without feedbacks remains compatible", () => {
  seedStore({ feedbacks: undefined });

  assert.deepEqual(storage.listSummaryFeedback(), []);
});

test("invalid rating values are normalized", () => {
  const feedback = storage.saveSummaryFeedback("summary-1", {
    overallRating: "excellent",
    tickerRating: "bad",
    conclusionRating: "invalid",
    checkpointRating: "good",
    geminiRating: "skipped",
    note: "invalid"
  });

  assert.equal(feedback.overallRating, "mixed");
  assert.equal(feedback.conclusionRating, "mixed");
  assert.equal(feedback.geminiRating, "not_used");
});
