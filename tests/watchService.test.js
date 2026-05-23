const test = require("node:test");
const assert = require("node:assert/strict");
const {
  latestSummaryInfo,
  buildProcessedWatchRecord,
  buildDuplicateWatchRecord,
  maybeOpenLatestSummary
} = require("../src/watchService");

test("watch processed record stores latest summary id and date", () => {
  const record = buildProcessedWatchRecord({
    filename: "chat.txt",
    filePath: "watch/chat.txt",
    finalPath: "watch/processed/chat.txt",
    fingerprint: { size: 100, mtimeMs: 10, sha256: "abc" },
    saved: {
      upload: { id: "upload-1", detectedDateCount: 3 },
      summaries: [
        { id: "summary-1", date: "2026-05-20" },
        { id: "summary-3", date: "2026-05-22" },
        { id: "summary-2", date: "2026-05-21" }
      ]
    },
    startedAt: "2026-05-23T00:00:00.000Z",
    processedAt: "2026-05-23T00:01:00.000Z"
  });

  assert.equal(record.status, "processed");
  assert.equal(record.latestSummaryId, "summary-3");
  assert.equal(record.latestSummaryDate, "2026-05-22");
  assert.equal(record.summaryCount, 3);
  assert.equal(record.detectedDateCount, 3);
  assert.equal(record.processedAt, "2026-05-23T00:01:00.000Z");
});

test("OPEN_SUMMARY_AFTER_WATCH=false does not call browser opener", async () => {
  let called = false;
  const opened = await maybeOpenLatestSummary(
    { latestSummaryId: "summary-1" },
    {
      env: { OPEN_SUMMARY_AFTER_WATCH: "false", PORT: "3000" },
      opener: async () => {
        called = true;
        return true;
      }
    }
  );

  assert.equal(opened, false);
  assert.equal(called, false);
});

test("OPEN_SUMMARY_AFTER_WATCH=true calls opener with latest summary URL", async () => {
  let openedUrl = "";
  const opened = await maybeOpenLatestSummary(
    { latestSummaryId: "summary-1" },
    {
      env: { OPEN_SUMMARY_AFTER_WATCH: "true", PORT: "3999" },
      opener: async (url) => {
        openedUrl = url;
        return true;
      }
    }
  );

  assert.equal(opened, true);
  assert.equal(openedUrl, "http://localhost:3999/summaries/summary-1");
});

test("duplicate watch record keeps skipped_duplicate behavior", () => {
  const record = buildDuplicateWatchRecord({
    filename: "chat.txt",
    filePath: "watch/chat.txt",
    finalPath: "watch/processed/chat.txt",
    fingerprint: { size: 100, mtimeMs: 10, sha256: "abc" },
    startedAt: "2026-05-23T00:00:00.000Z",
    processedAt: "2026-05-23T00:01:00.000Z"
  });

  assert.equal(record.status, "skipped_duplicate");
  assert.equal(record.summaryCount, undefined);
  assert.equal(record.latestSummaryId, undefined);
  assert.match(record.errorMessage, /이미 처리한 파일/);
});

test("latestSummaryInfo returns empty fields for no summaries", () => {
  assert.deepEqual(latestSummaryInfo([]), { latestSummaryId: "", latestSummaryDate: "" });
});
