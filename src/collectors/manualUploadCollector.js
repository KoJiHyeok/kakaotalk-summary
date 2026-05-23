const { BaseCollector, createCollectionResult } = require("./baseCollector");

class ManualUploadCollector extends BaseCollector {
  constructor() {
    super({
      name: "Manual Upload",
      type: "manual-upload",
      description: "사용자가 웹 화면에서 직접 카카오톡 TXT 파일을 업로드하는 안전한 수집 방식입니다.",
      enabled: true
    });
  }

  async collect({ fileName = "", content = "", metadata = {} } = {}) {
    if (!fileName || typeof content !== "string") return [];
    return [
      createCollectionResult({
        source: "manual-upload",
        fileName,
        content,
        metadata: {
          ...metadata,
          userProvided: true,
          pipeline: "processTxtContent"
        }
      })
    ];
  }
}

const manualUploadCollector = new ManualUploadCollector();

module.exports = {
  ManualUploadCollector,
  manualUploadCollector
};
