const test = require("node:test");
const assert = require("node:assert/strict");
const { generateDailySummary } = require("../src/summarizer");
const {
  buildGeminiPrompt,
  enhanceSummaryWithGemini,
  GEMINI_DISCLAIMER
} = require("../src/geminiSummarizer");

function ruleSummary() {
  return generateDailySummary("2026-05-22", [
    { date: "2026-05-22", time: "09:00", author: "a", text: "NVDA 실적 기대와 고점 리스크가 같이 언급됨" },
    { date: "2026-05-22", time: "09:01", author: "b", text: "FOMC 이후 금리 체크 필요" }
  ], { systemMessageCount: 1, mediaMessageCount: 2 });
}

test("Gemini disabled keeps rule-based summary and does not call client", async () => {
  const summary = ruleSummary();
  let called = false;
  const result = await enhanceSummaryWithGemini(summary, {
    client: {
      getGeminiConfig: () => ({ enabled: false, apiKey: "", model: "gemini-2.5-flash", maxInputChars: 20000 }),
      canUseGemini: () => false,
      generateGeminiContent: async () => {
        called = true;
      }
    }
  });
  assert.equal(called, false);
  assert.equal(result.geminiSummary, null);
  assert.equal(result.conclusion, summary.conclusion);
});

test("missing GEMINI_API_KEY skips Gemini", async () => {
  const result = await enhanceSummaryWithGemini(ruleSummary(), {
    client: {
      getGeminiConfig: () => ({ enabled: true, apiKey: "", model: "gemini-2.5-flash", maxInputChars: 20000 }),
      canUseGemini: (config) => Boolean(config.enabled && config.apiKey),
      generateGeminiContent: async () => {
        throw new Error("should not be called");
      }
    }
  });
  assert.equal(result.geminiSummary, null);
});

test("mock Gemini JSON response is stored on summary", async () => {
  const result = await enhanceSummaryWithGemini(ruleSummary(), {
    client: {
      getGeminiConfig: () => ({ enabled: true, apiKey: "test-key", model: "gemini-2.5-flash", maxInputChars: 20000 }),
      canUseGemini: () => true,
      generateGeminiContent: async () => ({
        model: "gemini-2.5-flash",
        text: JSON.stringify({
          executiveSummary: "채팅방에서는 NVDA 실적과 금리 체크가 핵심이라는 의견이 있었다.",
          marketMood: "혼조",
          keyTopics: ["NVDA 실적", "FOMC"],
          stockHighlights: [{ ticker: "NVDA", summary: "실적 기대", positive: "가이던스", negative: "고점", risk: "변동성", checkpoint: "실적 발표" }],
          risks: ["고점 부담"],
          nextCheckpoints: ["FOMC 확인"],
          disclaimer: GEMINI_DISCLAIMER
        })
      })
    }
  });
  assert.equal(result.geminiSummary.enabled, true);
  assert.equal(result.geminiSummary.marketMood, "혼조");
  assert.equal(result.geminiSummary.stockHighlights[0].ticker, "NVDA");
});

test("Gemini call failure is stored without breaking rule summary", async () => {
  const summary = ruleSummary();
  const result = await enhanceSummaryWithGemini(summary, {
    client: {
      getGeminiConfig: () => ({ enabled: true, apiKey: "test-key", model: "gemini-2.5-flash", maxInputChars: 20000 }),
      canUseGemini: () => true,
      generateGeminiContent: async () => {
        throw new Error("network failure");
      }
    }
  });
  assert.equal(result.conclusion, summary.conclusion);
  assert.equal(result.geminiSummary.failed, true);
  assert.match(result.geminiSummary.error, /network failure/);
});

test("Gemini JSON parse failure stores rawText", async () => {
  const result = await enhanceSummaryWithGemini(ruleSummary(), {
    client: {
      getGeminiConfig: () => ({ enabled: true, apiKey: "test-key", model: "gemini-2.5-flash", maxInputChars: 20000 }),
      canUseGemini: () => true,
      generateGeminiContent: async () => ({ model: "gemini-2.5-flash", text: "not json" })
    }
  });
  assert.equal(result.geminiSummary.parseFailed, true);
  assert.equal(result.geminiSummary.rawText, "not json");
});

test("Gemini prompt is bounded and does not include unlimited messages", () => {
  const messages = Array.from({ length: 80 }, (_, index) => ({
    time: "09:00",
    author: `user-${index}`,
    text: `NVDA sample message ${index}`
  }));
  const prompt = buildGeminiPrompt(ruleSummary(), messages, { skippedLineCount: 0 }, 3000);
  assert.ok(prompt.length <= 3000);
  assert.match(prompt, /원본 전체 대화가 아니라/);
});
