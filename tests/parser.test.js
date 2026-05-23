const test = require("node:test");
const assert = require("node:assert/strict");
const { parseKakaoTalkTxt, groupMessagesByDate, normalizeTime } = require("../src/parser");
const { extractTickers, analyzeMessages, categorizeTicker } = require("../src/analyzer");
const { generateDailySummary } = require("../src/summarizer");

test("normalizes Korean AM/PM time", () => {
  assert.equal(normalizeTime("오전", "12", "05"), "00:05");
  assert.equal(normalizeTime("오후", "1", "05"), "13:05");
});

test("parses KakaoTalk bracket export with multiline messages and system filtering", () => {
  const input = `--------------- 2026년 5월 20일 수요일 ---------------
[민수] [오전 9:02] NVDA 강세입니다.
추가 줄입니다.
[관리자] [오전 9:03] 공지: 테스트
[지연] [오후 1:15] TSLA는 관망`;

  const result = parseKakaoTalkTxt(input);
  assert.equal(result.stats.parsedMessageCount, 2);
  assert.equal(result.stats.systemMessageCount, 1);
  assert.equal(result.messages[0].date, "2026-05-20");
  assert.equal(result.messages[0].time, "09:02");
  assert.match(result.messages[0].text, /추가 줄/);
});

test("parses real KakaoTalk-like chat sample and separates media messages", () => {
  const input = `--------------- 2026년 5월 22일 금요일 ---------------
[세히자영] [오후 6:12] 프장이라 ㄱㅊ욤
[유튜브닉네임핫도그] [오후 6:13] 거기다 주식매입소각, 주주들 배당금 25배 상승, 중국매출은 합산 안함 등등 워....
[타고남은잿덩이] [오후 6:14] 이전에도 제가한번 올린적 있지만
[타고남은잿덩이] [오후 6:14] 주식 등락에 목숨거는건 개미들이고 회사는 주식가격이 어느정도 이상이기만 하면
[잠자는 원숭이  617423] [오후 6:15] 사진
[페이온] [오후 6:18] 돈이 남아돈다는건... 새로운 먹거리가 없다는게 아닐까? 싶어서요.. 
기술 개발하고도 남을 정도로 돈을 벌었다라..멋진일이긴한데..`;

  const result = parseKakaoTalkTxt(input);
  assert.equal(result.stats.parsedMessageCount, 5);
  assert.equal(result.stats.mediaMessageCount, 1);
  assert.equal(result.stats.excludedMessageCount, 1);
  assert.equal(result.stats.skippedLineCount, 0);
  assert.equal(result.messages[4].author, "페이온");
  assert.match(result.messages[4].text, /기술 개발하고도/);
});

test("standalone deleted-message line is excluded instead of merged into previous chat", () => {
  const input = `--------------- 2026년 5월 22일 금요일 ---------------
[사용자] [오후 6:12] AMD 실적 기대
메시지가 삭제되었습니다.
[사용자] [오후 6:13] NVDA 관망`;

  const result = parseKakaoTalkTxt(input);
  assert.equal(result.stats.parsedMessageCount, 2);
  assert.equal(result.stats.mediaMessageCount, 1);
  assert.doesNotMatch(result.messages[0].text, /삭제/);
});

test("skips bracket time messages when date is unknown", () => {
  const result = parseKakaoTalkTxt("[세히자영] [오후 6:12] 프장이라 ㄱㅊ욤");
  assert.equal(result.stats.parsedMessageCount, 0);
  assert.equal(result.stats.skippedLineCount, 1);
  assert.equal(result.skippedLineSamples[0].reason, "missing_date");
});

test("groups messages by date", () => {
  const result = parseKakaoTalkTxt(`2026. 5. 20. 오전 9:02, 민수 : NVDA
2026. 5. 21. 오후 1:15, 지연 : TSLA`);
  const grouped = groupMessagesByDate(result.messages);
  assert.deepEqual(Object.keys(grouped).sort(), ["2026-05-20", "2026-05-21"]);
});

test("supports multiple date separator variants", () => {
  assert.equal(parseKakaoTalkTxt(`--------------- 2026년 5월 22일 금요일 ---------------
[민수] [오후 6:12] NVDA`).messages[0].date, "2026-05-22");

  assert.equal(parseKakaoTalkTxt(`===== 2026. 05. 23. 토요일 =====
[민수] [오전 9:01] TSLA`).messages[0].date, "2026-05-23");

  assert.equal(parseKakaoTalkTxt(`Friday, May 22, 2026
[Minsoo] [6:12 PM] COIN`).messages[0].date, "2026-05-22");
});

test("supports inline Korean date messages and bracket date messages", () => {
  const result = parseKakaoTalkTxt(`2026년 5월 20일 오후 6:12, 민수 : NVDA 실적 기대
[2026. 5. 21. 09:03] [지훈] COIN 재진입 고민`);

  assert.equal(result.stats.parsedMessageCount, 2);
  assert.equal(result.messages[0].date, "2026-05-20");
  assert.equal(result.messages[0].time, "18:12");
  assert.equal(result.messages[1].date, "2026-05-21");
  assert.equal(result.messages[1].time, "09:03");
});

test("standalone system and media lines are excluded instead of merged into chat", () => {
  const result = parseKakaoTalkTxt(`2026년 5월 22일 금요일
[민수] [오후 6:12] AMD 확인
영희님이 들어왔습니다.
사진
[지훈] [오후 6:14] NVDA 체크`);

  assert.equal(result.stats.parsedMessageCount, 2);
  assert.equal(result.stats.systemMessageCount, 1);
  assert.equal(result.stats.mediaMessageCount, 1);
  assert.doesNotMatch(result.messages[0].text, /들어왔습니다|사진/);
});

test("skipped line samples are capped at ten", () => {
  const input = Array.from({ length: 12 }, (_, index) => `[민수] [오후 6:${String(index).padStart(2, "0")}] 날짜 없음`).join("\n");
  const result = parseKakaoTalkTxt(input);

  assert.equal(result.stats.skippedLineCount, 12);
  assert.equal(result.skippedLineSamples.length, 10);
  assert.equal(result.skippedLineSamples[0].reason, "missing_date");
});

test("ignores common export header lines", () => {
  const result = parseKakaoTalkTxt(`카카오톡 대화
저장한 날짜 : 2026년 5월 23일
--------------- 2026년 5월 23일 토요일 ---------------
[민수] [오전 9:02] NVDA`);

  assert.equal(result.stats.parsedMessageCount, 1);
  assert.equal(result.stats.skippedLineCount, 0);
});

test("extracts normalized tickers and Korean aliases", () => {
  assert.deepEqual(extractTickers("오늘 RKLb랑 엔비 엔비디아 NVDA 봅니다.").sort(), ["NVDA", "RKLB"]);
});

test("does not extract URL fragments as stock tickers", () => {
  assert.deepEqual(extractTickers("https://n.news.naver.com/article/001/123 AMD 확인").sort(), ["AMD"]);
});

test("blacklisted abbreviations are not extracted as tickers", () => {
  const tickers = extractTickers("AB ATM UFC DRAM ASE HTTPS COM KR ME NEWS TV WEB ETF USD");
  assert.deepEqual(tickers, []);
});

test("whitelisted short tickers are still extracted", () => {
  assert.deepEqual(extractTickers("MU AI GE GM T F").sort(), ["AI", "F", "GE", "GM", "MU", "T"]);
});

test("Korean aliases are normalized to ticker symbols", () => {
  const tickers = extractTickers("엔비 팔랑이 온큐 코베 샌디 마소 구글 테슬라 리게티 디웨이브 비트").sort();
  assert.deepEqual(tickers, ["BTC", "COIN", "GOOGL", "IONQ", "MSFT", "NVDA", "PLTR", "QBTS", "RGTI", "SNDK", "TSLA"]);
});

test("ETF and leveraged products are categorized", () => {
  const analysis = analyzeMessages([
    { date: "2026-05-22", time: "09:00", author: "a", text: "SOXL SOXS SOXX QQQ SPY" }
  ]);
  assert.deepEqual(analysis.topMentions.map((item) => item.category), ["etf", "etf", "etf", "etf", "etf"]);
});

test("crypto and macro tickers are categorized", () => {
  assert.equal(categorizeTicker("BTC"), "crypto");
  assert.equal(categorizeTicker("OIL"), "macro");
});

test("issue analysis includes US stock chat keywords", () => {
  const messages = [
    { date: "2026-05-22", time: "18:12", author: "a", text: "프장이라 ㄱㅊ욤" },
    { date: "2026-05-22", time: "18:13", author: "b", text: "자사주 소각이랑 배당 얘기가 있네요" },
    { date: "2026-05-22", time: "18:14", author: "c", text: "CPI랑 FOMC 금리 체크해야죠" }
  ];
  const analysis = analyzeMessages(messages);
  assert.equal(analysis.issueMessages.length, 3);
});

test("creates daily summary structure", () => {
  const messages = [
    { date: "2026-05-20", time: "09:00", author: "a", text: "NVDA 상승 기대" },
    { date: "2026-05-20", time: "09:01", author: "b", text: "TSLA 고점 리스크" },
    { date: "2026-05-20", time: "09:02", author: "c", text: "CPI 확인 후 관망" }
  ];
  const analysis = analyzeMessages(messages);
  const summary = generateDailySummary("2026-05-20", messages);
  assert.equal(analysis.messageCount, 3);
  assert.equal(summary.status, "completed");
  assert.equal(summary.sections.topStocks.length, 2);
});

test("surge and profit-taking chat produces concrete one-line conclusion", () => {
  const messages = [
    { date: "2026-05-22", time: "09:00", author: "a", text: "샌디스크 SNDK 급등 미쳤다 수익 인증 축하드립니다" },
    { date: "2026-05-22", time: "09:01", author: "b", text: "SNDK 익절 축하 도파민 장난 아니네요" },
    { date: "2026-05-22", time: "09:02", author: "c", text: "SOXL도 급등해서 수익 인증 많네요" },
    { date: "2026-05-22", time: "09:03", author: "d", text: "고점 과열은 조심해야 할 듯합니다" },
    { date: "2026-05-22", time: "09:04", author: "e", text: "다음 거래일 눌림 여부 체크" }
  ];
  const summary = generateDailySummary("2026-05-22", messages);
  assert.match(summary.conclusion, /급등/);
  assert.match(summary.conclusion, /수익/);
  assert.match(summary.conclusion, /축하/);
});

test("crypto keywords produce crypto-centered conclusion", () => {
  const messages = [
    { date: "2026-05-22", time: "09:00", author: "a", text: "비트 80k 돌파하면 코인베이스 COIN도 좋을까요" },
    { date: "2026-05-22", time: "09:01", author: "b", text: "BTC랑 코인 흐름이 주말에 중요합니다" },
    { date: "2026-05-22", time: "09:02", author: "c", text: "클래리티 법안이 코인 쪽 핵심 이슈 같아요" },
    { date: "2026-05-22", time: "09:03", author: "d", text: "리플도 같이 봐야죠" },
    { date: "2026-05-22", time: "09:04", author: "e", text: "코인베이스는 비트 따라갈 듯" }
  ];
  const summary = generateDailySummary("2026-05-22", messages);
  assert.match(summary.conclusion, /크립토/);
});

test("earnings keywords produce earnings-centered conclusion", () => {
  const messages = [
    { date: "2026-05-22", time: "09:00", author: "a", text: "NVDA 실발 기대됩니다" },
    { date: "2026-05-22", time: "09:01", author: "b", text: "실적이랑 가이던스가 핵심입니다" },
    { date: "2026-05-22", time: "09:02", author: "c", text: "어닝콜에서 마진 이야기 봐야죠" },
    { date: "2026-05-22", time: "09:03", author: "d", text: "발표 이후 반도체 방향이 중요합니다" },
    { date: "2026-05-22", time: "09:04", author: "e", text: "AMD도 실적 기대감 있습니다" }
  ];
  const summary = generateDailySummary("2026-05-22", messages);
  assert.match(summary.conclusion, /실적/);
  assert.match(summary.conclusion, /기대/);
});

test("small message count produces limited-flow conclusion", () => {
  const messages = [
    { date: "2026-05-22", time: "09:00", author: "a", text: "NVDA 관망" },
    { date: "2026-05-22", time: "09:01", author: "b", text: "TSLA 체크" }
  ];
  const summary = generateDailySummary("2026-05-22", messages);
  assert.match(summary.conclusion, /대화량이 적어/);
});

test("open chat bot welcome message is excluded from checkpoints", () => {
  const messages = [
    { date: "2026-05-22", time: "09:00", author: "오픈채팅봇", text: "오픈채팅봇 환영합니다. 다음 거래일에도 좋은 하루 보내세요." },
    { date: "2026-05-22", time: "09:01", author: "a", text: "NVDA 실발 이후 가이던스 확인해야 합니다" },
    { date: "2026-05-22", time: "09:02", author: "b", text: "FOMC 금리도 체크해야죠" },
    { date: "2026-05-22", time: "09:03", author: "c", text: "장후 반응 보고 재진입 고민" },
    { date: "2026-05-22", time: "09:04", author: "d", text: "CPI도 다음 체크포인트입니다" }
  ];
  const summary = generateDailySummary("2026-05-22", messages);
  const checkpoints = summary.sections.nextCheckPoints.join(" ");
  assert.doesNotMatch(checkpoints, /오픈채팅봇|환영합니다/);
});

test("health and travel chatter is excluded from checkpoints", () => {
  const messages = [
    { date: "2026-05-22", time: "09:00", author: "a", text: "여행 가서 약 챙기고 건강 관리해야죠 다음 거래일도 화이팅" },
    { date: "2026-05-22", time: "09:01", author: "b", text: "다이어트 음식 얘기하다가 장후 확인 못했네요" },
    { date: "2026-05-22", time: "09:02", author: "c", text: "NVDA 실발과 가이던스는 체크해야 합니다" },
    { date: "2026-05-22", time: "09:03", author: "d", text: "유가랑 환율도 봐야겠네요" },
    { date: "2026-05-22", time: "09:04", author: "e", text: "TSLA 지지선 깨지면 손절 고민" }
  ];
  const summary = generateDailySummary("2026-05-22", messages);
  const checkpoints = summary.sections.nextCheckPoints.join(" ");
  assert.doesNotMatch(checkpoints, /여행|건강|다이어트|음식/);
});

test("earnings macro and price-level messages remain in checkpoints", () => {
  const messages = [
    { date: "2026-05-22", time: "09:00", author: "a", text: "NVDA 실발 이후 가이던스 확인" },
    { date: "2026-05-22", time: "09:01", author: "b", text: "FOMC 금리랑 유가 체크해야 합니다" },
    { date: "2026-05-22", time: "09:02", author: "c", text: "TSLA 420 가격대 지지선 깨지면 손절" },
    { date: "2026-05-22", time: "09:03", author: "d", text: "코인 클래리티 법안도 봐야죠" },
    { date: "2026-05-22", time: "09:04", author: "e", text: "장후 애프터 반응 보고 재진입" }
  ];
  const summary = generateDailySummary("2026-05-22", messages);
  const checkpoints = summary.sections.nextCheckPoints.join(" ");
  assert.match(checkpoints, /실적|가이던스|FOMC|유가|가격대|지지선|클래리티|재진입/);
});

test("mentioned asset reason is a compact generated sentence", () => {
  const messages = [
    { date: "2026-05-22", time: "09:00", author: "a", text: "SNDK 급등해서 익절 수익 인증 축하합니다" },
    { date: "2026-05-22", time: "09:01", author: "b", text: "샌디스크 재진입 타이밍 봅니다" },
    { date: "2026-05-22", time: "09:02", author: "c", text: "SNDK 레버리지 수익 인증 많네요" },
    { date: "2026-05-22", time: "09:03", author: "d", text: "과열은 조심해야죠" },
    { date: "2026-05-22", time: "09:04", author: "e", text: "다음 거래일 눌림 확인" }
  ];
  const summary = generateDailySummary("2026-05-22", messages);
  const sndk = summary.sections.mentionedAssets.find((item) => item.ticker === "SNDK");
  assert.ok(sndk.reason.length <= 80);
  assert.match(sndk.reason, /급등|익절|재진입|수익/);
  assert.doesNotMatch(sndk.reason, /\/|09:00/);
});
