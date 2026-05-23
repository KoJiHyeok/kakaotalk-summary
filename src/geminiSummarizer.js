const geminiClient = require("./geminiClient");

const GEMINI_DISCLAIMER = "이 내용은 투자 조언이 아니라 카카오톡 채팅방 대화 요약입니다.";
const MAX_SAMPLE_MESSAGES = 50;

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function compact(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function truncate(text, maxChars) {
  const value = String(text || "");
  if (value.length <= maxChars) return value;
  return value.slice(0, Math.max(0, maxChars - 40)) + "\n...[truncated for Gemini input limit]";
}

function buildGeminiInput(summary, messages = [], parseStats = {}) {
  const sections = summary.sections || {};
  const sampleMessages = asArray(messages)
    .filter((message) => message?.text)
    .slice(0, MAX_SAMPLE_MESSAGES)
    .map((message) => ({
      time: message.time || "",
      author: message.author || "",
      text: compact(message.text).slice(0, 300)
    }));

  return {
    date: summary.date,
    messageCount: summary.messageCount || 0,
    excludedMessageCount: Number(summary.excludedCounts?.systemMessageCount || 0) + Number(summary.excludedCounts?.mediaMessageCount || 0),
    skippedLineCount: Number(parseStats.skippedLineCount || 0),
    marketMood: sections.marketMood || {},
    ruleBasedConclusion: sections.conclusion || summary.conclusion || "",
    keyFlows: asArray(sections.keyFlows).slice(0, 3),
    topMentions: asArray(summary.topMentions || sections.topStocks).slice(0, 10),
    stockDetails: asArray(sections.stockDetails).slice(0, 5),
    nextCheckpoints: asArray(sections.nextCheckPoints),
    debates: asArray(sections.majorDebates || sections.conflicts),
    risks: asArray(sections.riskWarnings || sections.risks),
    sampleMessages
  };
}

function buildGeminiPrompt(summary, messages, parseStats, maxInputChars = 20000) {
  const payload = buildGeminiInput(summary, messages, parseStats);
  const prompt = [
    "너는 미국주식 카카오톡 오픈채팅방 대화를 요약하는 분석 도우미다.",
    "아래 JSON 데이터는 원본 전체 대화가 아니라 규칙 기반 요약, 종목 집계, 제한된 샘플 메시지만 포함한다.",
    "",
    "작성 원칙:",
    "- 한국어로 작성한다.",
    "- 투자 조언처럼 단정하지 않는다.",
    "- '채팅방에서는 ~라는 의견이 있었다' 형태로 표현한다.",
    "- 매수/매도 추천을 하지 않는다.",
    "- 긍정 의견, 부정 의견, 리스크, 다음 체크포인트를 분리한다.",
    "- 잡담, 건강, 여행, 음식, 인사말은 제외한다.",
    "- 종목별 요약은 근거 중심으로 정리한다.",
    "- 면책 문구를 유지한다.",
    "",
    "반드시 JSON 객체만 응답한다. Markdown 코드블록을 쓰지 않는다.",
    "응답 스키마:",
    JSON.stringify({
      executiveSummary: "string",
      marketMood: "상승|하락|혼조|관망",
      keyTopics: ["string"],
      stockHighlights: [
        {
          ticker: "string",
          summary: "string",
          positive: "string",
          negative: "string",
          risk: "string",
          checkpoint: "string"
        }
      ],
      risks: ["string"],
      nextCheckpoints: ["string"],
      disclaimer: GEMINI_DISCLAIMER
    }, null, 2),
    "",
    "입력 데이터:",
    JSON.stringify(payload, null, 2)
  ].join("\n");

  return truncate(prompt, maxInputChars);
}

function extractJsonText(rawText) {
  const text = String(rawText || "").trim();
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch) return fenceMatch[1].trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) return text.slice(start, end + 1);
  return text;
}

function parseGeminiResponse(rawText) {
  const jsonText = extractJsonText(rawText);
  const parsed = JSON.parse(jsonText);
  return {
    executiveSummary: compact(parsed.executiveSummary),
    marketMood: compact(parsed.marketMood),
    keyTopics: asArray(parsed.keyTopics).map(compact).filter(Boolean),
    stockHighlights: asArray(parsed.stockHighlights).map((item) => ({
      ticker: compact(item.ticker),
      summary: compact(item.summary),
      positive: compact(item.positive),
      negative: compact(item.negative),
      risk: compact(item.risk),
      checkpoint: compact(item.checkpoint)
    })).filter((item) => item.ticker || item.summary),
    risks: asArray(parsed.risks).map(compact).filter(Boolean),
    nextCheckpoints: asArray(parsed.nextCheckpoints).map(compact).filter(Boolean),
    disclaimer: compact(parsed.disclaimer) || GEMINI_DISCLAIMER
  };
}

async function enhanceSummaryWithGemini(summary, options = {}) {
  const client = options.client || geminiClient;
  const config = options.config || client.getGeminiConfig?.(options.env) || geminiClient.getGeminiConfig(options.env);
  if (!client.canUseGemini?.(config)) return { ...summary, geminiSummary: null };

  const generatedAt = new Date().toISOString();
  try {
    const prompt = buildGeminiPrompt(summary, options.messages || [], options.parseStats || {}, config.maxInputChars || 20000);
    const result = await client.generateGeminiContent(prompt, config);
    if (result?.skipped) return { ...summary, geminiSummary: null };

    const rawText = result?.text || "";
    try {
      const parsed = parseGeminiResponse(rawText);
      return {
        ...summary,
        geminiSummary: {
          enabled: true,
          model: result.model || config.model,
          generatedAt,
          ...parsed
        }
      };
    } catch (parseError) {
      return {
        ...summary,
        geminiSummary: {
          enabled: true,
          model: result.model || config.model,
          generatedAt,
          rawText,
          parseFailed: true,
          error: parseError?.message || String(parseError),
          disclaimer: GEMINI_DISCLAIMER
        }
      };
    }
  } catch (error) {
    return {
      ...summary,
      geminiSummary: {
        enabled: true,
        failed: true,
        model: config.model,
        generatedAt,
        error: error?.message || String(error),
        disclaimer: GEMINI_DISCLAIMER
      }
    };
  }
}

module.exports = {
  GEMINI_DISCLAIMER,
  MAX_SAMPLE_MESSAGES,
  buildGeminiInput,
  buildGeminiPrompt,
  parseGeminiResponse,
  enhanceSummaryWithGemini
};
