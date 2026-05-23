const test = require("node:test");
const assert = require("node:assert/strict");
const { manualUploadCollector } = require("../src/collectors/manualUploadCollector");
const { WatchFolderCollector } = require("../src/collectors/watchFolderCollector");
const { officialApiCollectorExample } = require("../src/collectors/officialApiCollector.example");
const { webhookCollectorExample } = require("../src/collectors/webhookCollector.example");
const { isCollectionResult } = require("../src/collectors/baseCollector");
const { server } = require("../src/server");

test("manualUploadCollector returns available status", () => {
  const status = manualUploadCollector.getStatus();

  assert.equal(status.name, "Manual Upload");
  assert.equal(status.type, "manual-upload");
  assert.equal(status.enabled, true);
  assert.equal(status.status, "available");
});

test("watchFolderCollector returns watch service status", () => {
  const collector = new WatchFolderCollector({
    env: { WATCH_ENABLED: "true" },
    getStatus: () => ({
      watchDir: "watch",
      processedDir: "watch/processed",
      failedDir: "watch/failed",
      processedCount: 2,
      failedCount: 1,
      duplicateCount: 3,
      lastProcessedAt: "2026-05-23T01:00:00.000Z"
    })
  });
  const status = collector.getStatus();

  assert.equal(status.name, "Watch Folder");
  assert.equal(status.type, "watch-folder");
  assert.equal(status.status, "available");
  assert.equal(status.lastCollectedAt, "2026-05-23T01:00:00.000Z");
  assert.equal(status.metadata.processedCount, 2);
});

test("placeholder collectors do not perform collection", async () => {
  assert.equal(officialApiCollectorExample.isEnabled(), false);
  assert.equal(webhookCollectorExample.isEnabled(), false);
  assert.deepEqual(await officialApiCollectorExample.collect(), []);
  assert.deepEqual(await webhookCollectorExample.collect(), []);
});

test("manual upload collection result can feed processTxtContent", async () => {
  const [result] = await manualUploadCollector.collect({
    fileName: "chat.txt",
    content: "--------------- 2026년 5월 23일 토요일 ---------------\n[민수] [오전 9:00] NVDA",
    metadata: { byteLength: 72 }
  });

  assert.equal(isCollectionResult(result), true);
  assert.equal(result.source, "manual-upload");
  assert.equal(result.fileName, "chat.txt");
  assert.match(result.content, /NVDA/);
  assert.equal(result.metadata.pipeline, "processTxtContent");
});

test("/collectors page lists major collector names", async () => {
  await new Promise((resolve, reject) => {
    server.listen(0, async () => {
      try {
        const base = `http://127.0.0.1:${server.address().port}`;
        const response = await fetch(`${base}/collectors`);
        const html = await response.text();
        assert.equal(response.status, 200);
        assert.match(html, /Manual Upload/);
        assert.match(html, /Watch Folder/);
        assert.match(html, /Official API/);
        assert.match(html, /Webhook/);
        assert.match(html, /KakaoTalk unofficial collector/);
        server.close(resolve);
      } catch (error) {
        server.close(() => reject(error));
      }
    });
  });
});
