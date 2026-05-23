const { BaseCollector } = require("./baseCollector");
const { getWatchStatus } = require("../watchService");

class WatchFolderCollector extends BaseCollector {
  constructor({ getStatus = getWatchStatus, env = process.env } = {}) {
    super({
      name: "Watch Folder",
      type: "watch-folder",
      description: "사용자가 watch 폴더에 직접 저장한 TXT 파일을 기존 watchService가 자동 처리하는 안전한 수집 방식입니다.",
      enabled: env.WATCH_ENABLED !== "false"
    });
    this.readWatchStatus = getStatus;
    this.env = env;
  }

  isEnabled() {
    return this.env.WATCH_ENABLED !== "false";
  }

  async collect() {
    return [];
  }

  getStatus() {
    const status = this.readWatchStatus();
    return {
      ...super.getStatus(),
      status: this.isEnabled() ? "available" : "disabled",
      lastCollectedAt: status.lastProcessedAt || "",
      metadata: {
        watchDir: status.watchDir,
        processedDir: status.processedDir,
        failedDir: status.failedDir,
        processedCount: status.processedCount,
        failedCount: status.failedCount,
        duplicateCount: status.duplicateCount
      }
    };
  }
}

const watchFolderCollector = new WatchFolderCollector();

module.exports = {
  WatchFolderCollector,
  watchFolderCollector
};
