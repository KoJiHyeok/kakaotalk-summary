const { BaseCollector } = require("./baseCollector");

class OfficialApiCollectorExample extends BaseCollector {
  constructor() {
    super({
      name: "Official API",
      type: "official-api",
      description: "공식 API가 대화 원문 조회를 명시적으로 제공하고 사용 권한이 확인될 때만 연결할 placeholder입니다.",
      enabled: false,
      safetyNotes: "공식 API, 명시적 권한, 환경변수 기반 인증 정보, 감사 가능한 수집 범위가 준비된 경우에만 구현하세요. 비공식 카카오톡 프로토콜은 사용하지 않습니다."
    });
  }

  async collect() {
    // TODO: 공식 API가 제공되고 권한 및 약관 검토가 끝난 뒤에만 구현합니다.
    return [];
  }
}

const officialApiCollectorExample = new OfficialApiCollectorExample();

module.exports = {
  OfficialApiCollectorExample,
  officialApiCollectorExample
};
