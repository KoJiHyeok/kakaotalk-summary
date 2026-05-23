const DEFAULT_MODEL = "gemini-2.5-flash";

function getGeminiConfig(env = process.env) {
  return {
    enabled: String(env.GEMINI_ENABLED || "false").toLowerCase() === "true",
    apiKey: env.GEMINI_API_KEY || "",
    model: env.GEMINI_MODEL || DEFAULT_MODEL,
    maxInputChars: Number(env.GEMINI_MAX_INPUT_CHARS || 20000)
  };
}

function canUseGemini(config = getGeminiConfig()) {
  return Boolean(config.enabled && config.apiKey);
}

async function generateGeminiContent(prompt, config = getGeminiConfig()) {
  if (!canUseGemini(config)) {
    return { skipped: true, reason: "Gemini is disabled or GEMINI_API_KEY is missing.", model: config.model };
  }

  const { GoogleGenAI } = require("@google/genai");
  const ai = new GoogleGenAI({ apiKey: config.apiKey });
  const response = await ai.models.generateContent({
    model: config.model,
    contents: prompt
  });

  const text = typeof response.text === "function"
    ? response.text()
    : response.text || response.response?.text?.() || "";

  return { text, model: config.model };
}

module.exports = {
  DEFAULT_MODEL,
  getGeminiConfig,
  canUseGemini,
  generateGeminiContent
};
