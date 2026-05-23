const TICKER_BLACKLIST = new Set([
  "AB", "ATM", "UFC", "DRAM", "ASE",
  "HTTP", "HTTPS", "WWW", "COM", "CO", "KR", "ME", "NEWS", "TV", "WEB", "ETF", "USD",
  "THE", "AND", "FOR", "YOU", "ARE", "BUT", "NOT", "CAN", "ALL", "ANY", "GET", "HAS", "HAD",
  "WAS", "WERE", "THIS", "THAT", "WITH", "FROM", "WHEN", "WHAT", "WHY", "HOW", "OPEN", "CLOSE",
  "HIGH", "LOW", "BUY", "SELL", "HOLD", "LONG", "SHORT", "CALL", "PUT", "CEO", "CFO", "SEC",
  "IPO", "ADR", "RSI", "MACD", "ATH", "YOY", "QOQ", "NAVER", "YOUTUBE", "LIVE", "ARTICLE"
]);

const SHORT_TICKER_WHITELIST = new Set([
  "AI", "MU", "GE", "GM", "T", "F", "BA", "C", "V", "MA", "JPM", "MS", "GS"
]);

const ETF_TICKERS = new Set([
  "SOXL", "SOXS", "SOXX", "QQQ", "SPY", "TQQQ", "SQQQ", "SCHD", "VOO", "VTI", "DIA", "IWM",
  "XLK", "XLF", "XLE", "XLI", "XLY", "XLP", "XLC", "XLV", "XBI", "SMH", "ARKK", "TLT", "KWEB"
]);

const CRYPTO_TICKERS = new Set(["BTC", "ETH", "SOL", "XRP", "DOGE"]);
const MACRO_TICKERS = new Set(["OIL", "GOLD", "DXY", "VIX"]);

const KNOWN_STOCK_TICKERS = new Set([
  "AAPL", "MSFT", "NVDA", "AMD", "AMZN", "GOOGL", "GOOG", "META", "TSLA", "NFLX", "AVGO",
  "PLTR", "COIN", "IONQ", "RKLB", "ASTS", "SNDK", "INTC", "ARM", "APP", "OKLO", "RGTI", "QBTS",
  "ORCL", "CRM", "ADBE", "MU", "SMCI", "DELL", "HPE", "TSM", "ASML", "QCOM", "MRVL", "AMAT",
  "LRCX", "KLAC", "TXN", "PANW", "CRWD", "SNOW", "DDOG", "NET", "MDB", "NOW", "SHOP", "UBER",
  "ABNB", "MSTR", "HOOD", "SOFI", "RIVN", "LCID", "NIO", "XPEV", "LI", "BABA", "PDD", "JD",
  "WMT", "COST", "HD", "LOW", "TGT", "SBUX", "MCD", "NKE", "DIS", "PYPL", "SQ", "V", "MA",
  "JPM", "BAC", "C", "WFC", "GS", "MS", "BLK", "BRK", "UNH", "LLY", "NVO", "PFE", "MRNA",
  "JNJ", "ABBV", "XOM", "CVX", "OXY", "BA", "GE", "GM", "F", "T", "VZ", "BX", "CAT", "DE",
  "HIMS", "IREN", "WULF", "MARA", "RIOT", "CLSK", "CRCL", "HOLO", "SERV", "TEM", "ACHR", "JOBY"
]);

const ALLOWED_TICKERS = new Set([
  ...SHORT_TICKER_WHITELIST,
  ...ETF_TICKERS,
  ...CRYPTO_TICKERS,
  ...MACRO_TICKERS,
  ...KNOWN_STOCK_TICKERS
]);

const KOREAN_STOCK_ALIASES = {
  "테슬라": "TSLA",
  "엔비": "NVDA",
  "엔비디아": "NVDA",
  "애플": "AAPL",
  "마이크로소프트": "MSFT",
  "마소": "MSFT",
  "아마존": "AMZN",
  "구글": "GOOGL",
  "알파벳": "GOOGL",
  "메타": "META",
  "페북": "META",
  "페이스북": "META",
  "넷플릭스": "NFLX",
  "브로드컴": "AVGO",
  "어도비": "ADBE",
  "세일즈포스": "CRM",
  "오라클": "ORCL",
  "인텔": "INTC",
  "암드": "AMD",
  "마이크론": "MU",
  "팔란티어": "PLTR",
  "팔랑이": "PLTR",
  "팔란": "PLTR",
  "리비안": "RIVN",
  "루시드": "LCID",
  "코인": "COIN",
  "코베": "COIN",
  "코인베이스": "COIN",
  "로켓랩": "RKLB",
  "아스트스": "ASTS",
  "온큐": "IONQ",
  "아온큐": "IONQ",
  "아이온큐": "IONQ",
  "샌디": "SNDK",
  "샌디스크": "SNDK",
  "속슬": "SOXL",
  "쏙스": "SOXS",
  "반도체": "SOXX",
  "소파이": "SOFI",
  "리게티": "RGTI",
  "디웨이브": "QBTS",
  "비트": "BTC",
  "비트코인": "BTC",
  "이더": "ETH",
  "이더리움": "ETH",
  "나스닥": "QQQ",
  "큐큐큐": "QQQ",
  "에센피": "SPY",
  "S&P": "SPY",
  "유가": "OIL",
  "금값": "GOLD",
  "금선물": "GOLD",
  "달러지수": "DXY",
  "변동성": "VIX",
  "슈드": "SCHD"
};

const POSITIVE_WORDS = [
  "상승", "반등", "강세", "좋", "호재", "돌파", "매수", "추매", "실적 좋", "기대", "수혜",
  "저평가", "회복", "랠리", "신고가", "배당", "소각", "자사주", "성장", "돈이 남아", "멋진",
  "bull", "buy", "long", "beat", "growth"
];

const NEGATIVE_WORDS = [
  "하락", "급락", "약세", "나쁘", "악재", "손절", "매도", "고점", "거품", "리스크", "위험",
  "실적 우려", "파산", "규제", "유증", "유상증자", "과열", "먹거리", "없다는", "우려",
  "bear", "sell", "short", "miss", "risk"
];

const ISSUE_KEYWORDS = [
  "프장", "프리장", "애프터", "장전", "장후", "자사주", "주식매입", "주식매입소각", "소각",
  "배당", "실적", "가이던스", "earnings", "CPI", "PPI", "FOMC", "금리", "고용", "국채",
  "환율", "달러", "뉴스", "섹터", "규제", "전쟁", "대선", "정치", "인하", "인상", "연준", "파월",
  "중국매출", "매출", "마진"
];

const BUY_WORDS = ["매수", "추매", "분할매수", "진입", "담아", "buy", "long"];
const SELL_WORDS = ["매도", "익절", "손절", "정리", "팔", "sell", "short"];
const HOLD_WORDS = ["관망", "대기", "홀딩", "보유", "지켜", "기다", "hold", "wait"];
const RISK_WORDS = ["과열", "고점", "리스크", "위험", "유상증자", "유증", "파산", "규제", "급락", "하락", "거품", "실적 우려", "먹거리", "없다는"];
const IDEA_WORDS = ["관심", "테마", "섹터", "ETF", "옵션", "레버리지", "장기", "장투", "스윙", "단타", "신규", "새로", "먹거리"];
const CHECK_WORDS = ["내일", "다음", "체크", "확인", "장전", "장후", "프장", "애프터", "실적", "발표", "가격", "지지", "저항", "CPI", "FOMC", "금리"];
const LONG_TERM_WORDS = ["장기", "장투", "보유", "홀딩", "배당", "성장", "가이던스", "먹거리", "기술 개발"];
const SHORT_TERM_WORDS = ["단타", "스윙", "프장", "장전", "장후", "애프터", "급등", "급락", "등락", "가격"];

function normalizeTicker(raw) {
  return raw.toUpperCase();
}

function categorizeTicker(ticker) {
  if (ETF_TICKERS.has(ticker)) return "etf";
  if (CRYPTO_TICKERS.has(ticker)) return "crypto";
  if (MACRO_TICKERS.has(ticker)) return "macro";
  if (KNOWN_STOCK_TICKERS.has(ticker) || SHORT_TICKER_WHITELIST.has(ticker)) return "stock";
  return "unknown";
}

function isAllowedTicker(ticker) {
  if (!ticker || TICKER_BLACKLIST.has(ticker)) return false;
  if (ticker.length <= 2) return SHORT_TICKER_WHITELIST.has(ticker);
  return ALLOWED_TICKERS.has(ticker);
}

function stripNoise(text) {
  return text
    .replace(/https?:\/\/\S+/gi, " ")
    .replace(/\b[\w.-]+@[\w.-]+\.\w+\b/g, " ")
    .replace(/카카오\s*샵검색[^\n]*/g, " ")
    .replace(/샵검색[^\n]*/g, " ");
}

function extractTickers(text) {
  const found = new Set();
  const textWithoutNoise = stripNoise(text);
  const englishMatches = textWithoutNoise.match(/\b[A-Za-z]{1,5}\b/g) || [];

  englishMatches.forEach((word) => {
    const ticker = normalizeTicker(word);
    if (isAllowedTicker(ticker)) found.add(ticker);
  });

  Object.entries(KOREAN_STOCK_ALIASES).forEach(([alias, ticker]) => {
    if (text.includes(alias) && isAllowedTicker(ticker)) found.add(ticker);
  });

  return Array.from(found);
}

function countKeywordHits(text, keywords) {
  const lowered = text.toLowerCase();
  return keywords.reduce((count, keyword) => count + (lowered.includes(keyword.toLowerCase()) ? 1 : 0), 0);
}

function classifySentiment(text) {
  const positive = countKeywordHits(text, POSITIVE_WORDS);
  const negative = countKeywordHits(text, NEGATIVE_WORDS);
  if (positive > negative) return "상승";
  if (negative > positive) return "하락";
  if (positive > 0 && negative > 0) return "혼조";
  return "관망";
}

function pickExamples(messages, keywords, limit = 5) {
  return messages
    .filter((message) => keywords.some((keyword) => message.text.toLowerCase().includes(keyword.toLowerCase())))
    .slice(0, limit)
    .map((message) => ({
      time: message.time,
      author: message.author,
      text: message.text
    }));
}

function analyzeMessages(messages) {
  const mentions = new Map();
  const allText = messages.map((message) => message.text).join("\n");
  let positiveHits = 0;
  let negativeHits = 0;

  messages.forEach((message) => {
    const tickers = extractTickers(message.text);
    const sentiment = classifySentiment(message.text);
    if (sentiment === "상승") positiveHits += 1;
    if (sentiment === "하락") negativeHits += 1;

    tickers.forEach((ticker) => {
      if (!mentions.has(ticker)) {
        mentions.set(ticker, {
          ticker,
          category: categorizeTicker(ticker),
          count: 0,
          positive: 0,
          negative: 0,
          neutral: 0,
          messages: []
        });
      }
      const item = mentions.get(ticker);
      item.count += 1;
      item.messages.push(message);
      if (sentiment === "상승") item.positive += 1;
      else if (sentiment === "하락") item.negative += 1;
      else item.neutral += 1;
    });
  });

  const topMentions = Array.from(mentions.values())
    .sort((a, b) => b.count - a.count || a.ticker.localeCompare(b.ticker))
    .slice(0, 10)
    .map((item) => ({
      ticker: item.ticker,
      category: item.category,
      count: item.count,
      sentiment: item.positive > item.negative ? "상승" : item.negative > item.positive ? "하락" : item.positive || item.negative ? "혼조" : "관망",
      keyPoints: item.messages.slice(0, 3).map((message) => message.text)
    }));

  let roomSentiment = "관망";
  if (positiveHits > negativeHits * 1.2 && positiveHits > 0) roomSentiment = "상승";
  else if (negativeHits > positiveHits * 1.2 && negativeHits > 0) roomSentiment = "하락";
  else if (positiveHits > 0 && negativeHits > 0) roomSentiment = "혼조";

  return {
    messageCount: messages.length,
    roomSentiment,
    positiveHits,
    negativeHits,
    topMentions,
    issueMessages: pickExamples(messages, ISSUE_KEYWORDS, 8),
    buyMessages: pickExamples(messages, BUY_WORDS, 6),
    sellMessages: pickExamples(messages, SELL_WORDS, 6),
    holdMessages: pickExamples(messages, HOLD_WORDS, 6),
    riskMessages: pickExamples(messages, RISK_WORDS, 8),
    ideaMessages: pickExamples(messages, IDEA_WORDS, 8),
    checkMessages: pickExamples(messages, CHECK_WORDS, 8),
    longTermMessages: pickExamples(messages, LONG_TERM_WORDS, 8),
    shortTermMessages: pickExamples(messages, SHORT_TERM_WORDS, 8),
    allText
  };
}

module.exports = {
  analyzeMessages,
  extractTickers,
  classifySentiment,
  categorizeTicker,
  KOREAN_STOCK_ALIASES,
  ISSUE_KEYWORDS
};
