const SAFE_COLLECTION_NOTICE = "이 앱은 카카오톡 비공식 프로토콜, 내부 API, 세션 재사용, 보안 우회 방식의 자동 수집을 지원하지 않습니다. 현재 안전하게 지원하는 방식은 사용자가 직접 내보낸 TXT 파일과 watch 폴더 자동 처리입니다.";

function createCollectionResult({ source, fileName = "", content = "", collectedAt = new Date().toISOString(), metadata = {} }) {
  return {
    source,
    fileName,
    content,
    collectedAt,
    metadata: metadata && typeof metadata === "object" ? metadata : {}
  };
}

function isCollectionResult(value) {
  return Boolean(
    value &&
    typeof value.source === "string" &&
    typeof value.fileName === "string" &&
    typeof value.content === "string" &&
    typeof value.collectedAt === "string" &&
    value.metadata &&
    typeof value.metadata === "object"
  );
}

class BaseCollector {
  constructor({ name, type, description, enabled = false, lastCollectedAt = "", safetyNotes = SAFE_COLLECTION_NOTICE }) {
    this.name = name;
    this.type = type;
    this.description = description;
    this.enabled = enabled;
    this.lastCollectedAt = lastCollectedAt;
    this.safetyNotes = safetyNotes;
  }

  isEnabled() {
    return Boolean(this.enabled);
  }

  async collect() {
    return [];
  }

  getStatus() {
    return {
      name: this.name,
      type: this.type,
      enabled: this.isEnabled(),
      status: this.isEnabled() ? "available" : "not_connected",
      description: this.description,
      lastCollectedAt: this.lastCollectedAt || "",
      safetyNotes: this.safetyNotes
    };
  }
}

module.exports = {
  SAFE_COLLECTION_NOTICE,
  BaseCollector,
  createCollectionResult,
  isCollectionResult
};
