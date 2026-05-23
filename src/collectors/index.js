const { BaseCollector, SAFE_COLLECTION_NOTICE } = require("./baseCollector");
const { manualUploadCollector } = require("./manualUploadCollector");
const { watchFolderCollector } = require("./watchFolderCollector");
const { officialApiCollectorExample } = require("./officialApiCollector.example");
const { webhookCollectorExample } = require("./webhookCollector.example");

const unsupportedKakaoCollector = new BaseCollector({
  name: "KakaoTalk unofficial collector",
  type: "unsupported",
  description: "비공식 프로토콜, 내부 API, 로그인 세션 재사용, 앱 데이터 직접 접근, 보안 우회 방식은 지원하지 않습니다.",
  enabled: false,
  safetyNotes: SAFE_COLLECTION_NOTICE
});

unsupportedKakaoCollector.getStatus = function getUnsupportedStatus() {
  return {
    ...BaseCollector.prototype.getStatus.call(this),
    status: "unsupported"
  };
};

function getCollectors() {
  return [
    manualUploadCollector,
    watchFolderCollector,
    officialApiCollectorExample,
    webhookCollectorExample,
    unsupportedKakaoCollector
  ];
}

function getCollectorStatuses() {
  return getCollectors().map((collector) => collector.getStatus());
}

module.exports = {
  SAFE_COLLECTION_NOTICE,
  getCollectors,
  getCollectorStatuses,
  manualUploadCollector,
  watchFolderCollector,
  officialApiCollectorExample,
  webhookCollectorExample,
  unsupportedKakaoCollector
};
