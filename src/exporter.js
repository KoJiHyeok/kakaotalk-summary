const { categorizeTicker } = require("./analyzer");

const DISCLAIMER = "이 내용은 투자 조언이 아니라 카카오톡 채팅방 대화 요약입니다.";

const GLOSSARY = [
  ["실발", "실적 발표"],
  ["프장", "프리마켓"],
  ["애프터", "장후 거래"],
  ["포모", "FOMO, 상승 기회를 놓칠까 두려워하는 심리"],
  ["익절", "이익 실현"],
  ["손절", "손실 확정 매도"],
  ["추매", "추가 매수"],
  ["평단", "평균 매수가"],
  ["물타기", "평균 단가를 낮추기 위한 추가 매수"],
  ["레버리지", "기초자산 수익률을 배수로 추종하는 상품"],
  ["인버스", "기초자산 하락에 베팅하는 상품"],
  ["FOMC", "미국 연방공개시장위원회"],
  ["CPI", "소비자물가지수"],
  ["가이던스", "기업이 제시하는 향후 실적 전망"],
  ["WTI", "미국 서부텍사스산 원유 가격 지표"]
];

function value(value, fallback = "") {
  return value === undefined || value === null || value === "" ? fallback : String(value);
}

function compact(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function bulletList(items, fallback = "해당 내용이 명확히 감지되지 않았습니다.") {
  const lines = asArray(items)
    .map((item) => {
      if (typeof item === "string") return compact(item);
      if (item?.text) return compact(item.text);
      if (item?.topic) return compact(`${item.topic}: ${item.pro || ""} / ${item.con || ""}`);
      return compact(JSON.stringify(item));
    })
    .filter(Boolean);
  return lines.length ? lines.map((line) => `- ${line}`).join("\n") : `- ${fallback}`;
}

function topMentions(row) {
  const sections = row?.summary?.sections || {};
  if (Array.isArray(sections.topStocks) && sections.topStocks.length) return sections.topStocks;
  return asArray(row?.topMentions);
}

function mentionedAssets(row) {
  const assets = row?.summary?.sections?.mentionedAssets;
  return Array.isArray(assets) && assets.length ? assets : topMentions(row);
}

function itemReason(item) {
  return String(item?.reason || asArray(item?.keyPoints).join(" / ")).trim();
}

function itemCategory(item) {
  const ticker = value(item?.ticker, "").toUpperCase();
  return value(item?.category || (ticker ? categorizeTicker(ticker) : ""), "unknown");
}

function excludedCount(row) {
  const counts = row?.summary?.excludedCounts || {};
  return Number(counts.systemMessageCount || 0) + Number(counts.mediaMessageCount || 0);
}

function renderStockDetails(details) {
  const items = asArray(details).slice(0, 5);
  if (!items.length) return "- 종목별 상세 분석이 충분하지 않습니다.";
  return items.map((item, index) => [
    `### ${index + 1}. ${value(item.ticker, "UNKNOWN")}`,
    `- 핵심 의견: ${value(item.mainOpinions, "명확한 핵심 의견이 충분하지 않습니다.")}`,
    `- 긍정 근거: ${value(item.positiveReasons, "명확한 긍정 근거가 충분하지 않습니다.")}`,
    `- 부정/리스크: ${value(item.negativeReasons || item.risks, "명확한 부정 근거 또는 리스크가 충분하지 않습니다.")}`,
    `- 체크포인트: ${value(item.nextCheckPoints, "명확한 체크포인트가 충분하지 않습니다.")}`
  ].join("\n")).join("\n\n");
}

function renderGeminiMarkdown(geminiSummary) {
  if (!geminiSummary) return "";
  if (geminiSummary.failed) {
    return [
      "## Gemini 고급 요약",
      `- 생성 실패: ${value(geminiSummary.error, "알 수 없는 오류")}`,
      ""
    ].join("\n");
  }
  if (geminiSummary.parseFailed) {
    return [
      "## Gemini 고급 요약",
      "- JSON 파싱에 실패해 원문 응답을 보관했습니다.",
      "",
      "```text",
      value(geminiSummary.rawText, ""),
      "```",
      ""
    ].join("\n");
  }
  const highlights = asArray(geminiSummary.stockHighlights).map((item) => [
    `### ${value(item.ticker, "UNKNOWN")}`,
    `- 요약: ${value(item.summary)}`,
    `- 긍정: ${value(item.positive)}`,
    `- 부정: ${value(item.negative)}`,
    `- 리스크: ${value(item.risk)}`,
    `- 체크포인트: ${value(item.checkpoint)}`
  ].join("\n")).join("\n\n");
  return [
    "## Gemini 고급 요약",
    `- 모델: ${value(geminiSummary.model)}`,
    `- 생성 시각: ${value(geminiSummary.generatedAt)}`,
    `- 시장 분위기: ${value(geminiSummary.marketMood)}`,
    "",
    "### Executive Summary",
    value(geminiSummary.executiveSummary, "Gemini 요약 내용이 없습니다."),
    "",
    "### 핵심 주제",
    bulletList(geminiSummary.keyTopics),
    "",
    "### 종목별 하이라이트",
    highlights || "- 종목별 Gemini 하이라이트가 없습니다.",
    "",
    "### Gemini 리스크",
    bulletList(geminiSummary.risks),
    "",
    "### Gemini 다음 체크포인트",
    bulletList(geminiSummary.nextCheckpoints),
    ""
  ].join("\n");
}

function createMarkdownExport(row, upload = {}) {
  const summary = row?.summary || {};
  const sections = summary.sections || {};
  const date = value(summary.date || row?.date, "unknown-date");
  const marketMood = sections.marketMood || {};
  const conclusion = value(sections.conclusion || summary.conclusion || row?.conclusion, "한 줄 결론이 없습니다.");
  const assets = mentionedAssets(row).slice(0, 10);

  return [
    `# ${date} 미국주식 오픈채팅방 요약`,
    "",
    "## 기본 정보",
    `- 날짜: ${date}`,
    `- 총 메시지 수: ${Number(row?.messageCount || summary.messageCount || 0)}`,
    `- 제외 메시지 수: ${excludedCount(row)}`,
    `- 파싱 실패 수: ${Number(upload?.skippedLineCount || 0)}`,
    `- 시장 분위기: ${value(marketMood.sentiment, "관망")}`,
    "",
    "## 한 줄 결론",
    conclusion,
    "",
    renderGeminiMarkdown(summary.geminiSummary),
    "## 오늘의 핵심 흐름 3가지",
    bulletList(asArray(sections.keyFlows).slice(0, 3)),
    "",
    "## TOP 종목/자산 요약",
    assets.length
      ? assets.map((item, index) => `- ${index + 1}. ${value(item.ticker, "UNKNOWN")} (${itemCategory(item)}, ${Number(item.count || 0)}회): ${value(itemReason(item), "언급 이유가 충분하지 않습니다.")}`).join("\n")
      : "- TOP 종목/자산 데이터가 없습니다.",
    "",
    "## 다음 거래일 체크포인트",
    bulletList(sections.nextCheckPoints),
    "",
    "## 종목별 상세 분석 TOP 5",
    renderStockDetails(sections.stockDetails),
    "",
    "## 주요 논쟁",
    bulletList(sections.majorDebates || sections.conflicts),
    "",
    "## 리스크 경고",
    bulletList(sections.riskWarnings || sections.risks),
    "",
    "## 용어 보기",
    GLOSSARY.map(([term, desc]) => `- ${term}: ${desc}`).join("\n"),
    "",
    "## 면책 문구",
    DISCLAIMER,
    ""
  ].join("\n");
}

function csvEscape(value) {
  const text = String(value ?? "");
  if (/[",\r\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function csvLine(values) {
  return values.map(csvEscape).join(",");
}

function createTopMentionsCsv(row) {
  const date = value(row?.summary?.date || row?.date, "unknown-date");
  const rows = topMentions(row).slice(0, 10).map((item, index) => [
    date,
    index + 1,
    value(item.ticker, "UNKNOWN"),
    itemCategory(item),
    Number(item.count || 0),
    value(item.sentiment),
    itemReason(item)
  ]);
  return [
    csvLine(["date", "rank", "ticker", "category", "count", "sentiment", "reason"]),
    ...rows.map(csvLine)
  ].join("\r\n") + "\r\n";
}

function createAllTopMentionsCsv(rows) {
  const lines = [csvLine(["date", "ticker", "category", "count", "sentiment", "reason"])];
  asArray(rows).forEach((row) => {
    const date = value(row?.summary?.date || row?.date, "unknown-date");
    topMentions(row).forEach((item) => {
      lines.push(csvLine([
        date,
        value(item.ticker, "UNKNOWN"),
        itemCategory(item),
        Number(item.count || 0),
        value(item.sentiment),
        itemReason(item)
      ]));
    });
  });
  return lines.join("\r\n") + "\r\n";
}

function markdownFilename(row) {
  return `kakaotalk-stock-summary-${value(row?.summary?.date || row?.date, "unknown-date")}.md`;
}

function csvFilename(row) {
  return `kakaotalk-stock-top-mentions-${value(row?.summary?.date || row?.date, "unknown-date")}.csv`;
}

module.exports = {
  DISCLAIMER,
  GLOSSARY,
  createMarkdownExport,
  createTopMentionsCsv,
  createAllTopMentionsCsv,
  csvEscape,
  markdownFilename,
  csvFilename
};
