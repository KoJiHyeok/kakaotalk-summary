const { BaseCollector } = require("./baseCollector");

class WebhookCollectorExample extends BaseCollector {
  constructor() {
    super({
      name: "Webhook",
      type: "webhook",
      description: "사용자가 권한을 가진 안전한 로그 소스가 서버로 TXT 또는 메시지 데이터를 보내는 경우를 위한 placeholder입니다.",
      enabled: false,
      safetyNotes: "웹훅 발신 주체, 원본 대화 수집 권한, 서명 검증, 재전송 방지, 저장 범위를 먼저 설계하세요. 비공식 카카오톡 접근은 사용하지 않습니다."
    });
  }

  async collect() {
    // TODO: 신뢰 가능한 웹훅 발신자와 서명 검증이 준비된 뒤에만 구현합니다.
    return [];
  }
}

const webhookCollectorExample = new WebhookCollectorExample();

module.exports = {
  WebhookCollectorExample,
  webhookCollectorExample
};
