const { parseKakaoTalkTxt, groupMessagesByDate } = require("./parser");
const { generateDailySummary } = require("./summarizer");
const { enhanceSummaryWithGemini } = require("./geminiSummarizer");
const storage = require("./storage");

function countByDate(messages) {
  return (Array.isArray(messages) ? messages : []).reduce((counts, message) => {
    if (!message?.date) return counts;
    counts[message.date] = (counts[message.date] || 0) + 1;
    return counts;
  }, {});
}

function createFailedDailySummary(date, messages, counts, error) {
  return {
    date,
    messageCount: Array.isArray(messages) ? messages.length : 0,
    excludedCounts: {
      systemMessageCount: counts.systemMessageCount || 0,
      mediaMessageCount: counts.mediaMessageCount || 0
    },
    status: "failed",
    topMentions: [],
    conclusion: "요약 생성 실패",
    errorMessage: error?.message || String(error),
    errorStack: error?.stack || "",
    sections: {
      marketMood: {
        summary: "해당 날짜의 요약 생성 중 오류가 발생했습니다.",
        sentiment: "관망",
        evidence: error?.message || String(error)
      },
      topStocks: [],
      stockDetails: [],
      issues: [],
      tradingViews: { buy: [], sell: [], hold: [] },
      risks: [],
      ideas: [],
      conflicts: [],
      nextCheckPoints: [],
      conclusion: "요약 생성 실패"
    }
  };
}

async function processTxtContent({
  content,
  originalFilename,
  source = "web_upload",
  sourcePath = "",
  watchFingerprint = "",
  onDailyError
}) {
  const parseResult = parseKakaoTalkTxt(content);
  const grouped = groupMessagesByDate(parseResult.messages || []);
  const mediaCounts = countByDate(parseResult.mediaMessages || []);
  const systemCounts = countByDate(parseResult.systemMessages || []);
  const allDates = Array.from(new Set((parseResult.allMessages || []).map((message) => message.date).filter(Boolean))).sort();

  const dailySummaries = await Promise.all(allDates.map(async (date) => {
    const messages = grouped[date] || [];
    const counts = {
      mediaMessageCount: mediaCounts[date] || 0,
      systemMessageCount: systemCounts[date] || 0
    };
    try {
      const summary = generateDailySummary(date, messages, counts);
      return await enhanceSummaryWithGemini(summary, {
        messages,
        parseStats: parseResult.stats
      });
    } catch (error) {
      if (typeof onDailyError === "function") {
        onDailyError(error, { date, messageCount: messages.length, counts });
      }
      return { ...createFailedDailySummary(date, messages, counts, error), geminiSummary: null };
    }
  }));

  return storage.saveUploadResult({
    originalFilename,
    parseResult,
    dailySummaries,
    source,
    sourcePath,
    watchFingerprint
  });
}

module.exports = {
  processTxtContent,
  countByDate,
  createFailedDailySummary
};
