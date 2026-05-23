const { analyzeMessages, classifySentiment, extractTickers } = require("./analyzer");

const THEME_DEFINITIONS = [
  {
    id: "surge",
    label: "급등 및 수익 인증",
    keywords: ["급등", "폭등", "미쳤", "도파민", "축하", "수익", "인증", "익절", "불기둥", "텐버거"]
  },
  {
    id: "earnings",
    label: "실적 기대",
    keywords: ["실발", "실적", "가이던스", "어닝", "earnings", "발표", "어닝콜"]
  },
  {
    id: "trading",
    label: "매매 대응",
    keywords: ["익절", "손절", "추매", "분할매수", "평단", "물타기", "진입", "비중", "매수", "매도"]
  },
  {
    id: "risk",
    label: "과열·리스크",
    keywords: ["포모", "고점", "과열", "무섭", "리스크", "위험", "급락", "하락", "물림"]
  },
  {
    id: "macro",
    label: "매크로 이슈",
    keywords: ["금리", "FOMC", "CPI", "유가", "이란", "호르무즈", "전쟁", "국채", "파월", "환율"]
  },
  {
    id: "crypto",
    label: "크립토 이슈",
    keywords: ["비트", "80k", "코인", "코인베이스", "클래리티", "리플", "BTC", "ETH", "비트코인"]
  },
  {
    id: "quantum",
    label: "양자 섹터",
    keywords: ["양자", "온큐", "아이온큐", "아온큐", "리게티", "디웨이브", "IONQ", "RGTI", "QBTS"]
  },
  {
    id: "space",
    label: "우주 섹터",
    keywords: ["우주", "AST", "ASTS", "RKLB", "스페이스X", "로켓랩", "발사"]
  }
];

const CHATTER_KEYWORDS = [
  "여행", "건강", "음식", "맛집", "점심", "저녁", "아침", "병원", "감기", "운동", "일상",
  "농담", "ㅋㅋ", "ㅎㅎ", "안녕하세요", "반갑습니다", "들어왔습니다", "나갔습니다", "호텔", "비행기"
];

function includesKeyword(text, keyword) {
  return text.toLowerCase().includes(keyword.toLowerCase());
}

function messageMatches(message, keywords) {
  return keywords.some((keyword) => includesKeyword(message.text, keyword));
}

function summarizeTexts(messages, fallback) {
  if (!messages.length) return fallback;
  return messages
    .slice(0, 3)
    .map((message) => `${message.time || ""} ${message.text.replace(/\s+/g, " ").slice(0, 140)}`.trim())
    .join(" / ");
}

function filterByKeywords(messages, keywords) {
  return messages.filter((message) => messageMatches(message, keywords));
}

function messageMentionsTicker(message, ticker) {
  return extractTickers(message.text).includes(ticker);
}

function splitEvidence(messages, ticker) {
  const related = messages.filter((message) => messageMentionsTicker(message, ticker));
  const positive = related.filter((message) => classifySentiment(message.text) === "상승").slice(0, 3);
  const negative = related.filter((message) => classifySentiment(message.text) === "하락").slice(0, 3);
  const risks = filterByKeywords(related, ["리스크", "위험", "고점", "과열", "규제", "급락", "하락", "먹거리", "없다는"]).slice(0, 3);
  const longTerm = filterByKeywords(related, ["장기", "장투", "홀딩", "보유", "배당", "소각", "자사주", "실적", "가이던스", "기술 개발"]).slice(0, 3);
  const shortTerm = filterByKeywords(related, ["단타", "스윙", "프장", "장전", "장후", "애프터", "등락", "급등", "급락"]).slice(0, 3);
  const neutral = related.filter((message) => !positive.includes(message) && !negative.includes(message)).slice(0, 3);

  return { related, positive, negative, risks, longTerm, shortTerm, neutral };
}

function createStockDetails(messages, topMentions) {
  return topMentions.map((mention) => {
    const evidence = splitEvidence(messages, mention.ticker);
    return {
      ticker: mention.ticker,
      category: mention.category || "unknown",
      mainOpinions: `채팅방에서는 ${summarizeTexts(evidence.related, "해당 종목에 대한 구체적 의견은 많지 않았습니다.")}`,
      positiveReasons: `채팅방에서는 ${summarizeTexts(evidence.positive, "뚜렷한 긍정 근거가 충분히 언급되지 않았습니다.")}`,
      negativeReasons: `채팅방에서는 ${summarizeTexts(evidence.negative, "뚜렷한 부정 근거가 충분히 언급되지 않았습니다.")}`,
      risks: `채팅방에서는 ${summarizeTexts(evidence.risks, "별도 리스크 언급은 제한적이었습니다.")}`,
      longTermView: `채팅방에서는 ${summarizeTexts(evidence.longTerm, "장투 관점이 뚜렷하게 분리되어 언급되지는 않았습니다.")}`,
      shortTermView: `채팅방에서는 ${summarizeTexts(evidence.shortTerm, "단타 또는 스윙 관점이 뚜렷하게 분리되어 언급되지는 않았습니다.")}`,
      nextCheckPoints: `채팅방에서는 ${summarizeTexts(evidence.neutral, "추가 가격 흐름, 실적, 장전/장후 이벤트 확인이 필요하다는 수준으로 정리됩니다.")}`
    };
  });
}

function analyzeThemes(messages) {
  const chatterMessages = messages.filter((message) => messageMatches(message, CHATTER_KEYWORDS));
  const investMessages = messages.filter((message) => !messageMatches(message, CHATTER_KEYWORDS));
  const baseMessages = investMessages.length ? investMessages : messages;
  const themes = THEME_DEFINITIONS.map((theme) => {
    const matchedMessages = baseMessages.filter((message) => messageMatches(message, theme.keywords));
    return {
      ...theme,
      count: matchedMessages.length,
      examples: matchedMessages.slice(0, 3)
    };
  }).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

  return {
    themes,
    chatterCount: chatterMessages.length,
    chatterRatio: messages.length ? chatterMessages.length / messages.length : 0
  };
}

function assetPhrase(topMentions, limit = 3) {
  return topMentions.slice(0, limit).map((item) => item.ticker).join(", ");
}

function createThemePhrase(theme) {
  if (!theme || theme.count === 0) return "종목별 가격 흐름";
  return theme.label;
}

function createConclusion(date, analysis, themeAnalysis) {
  if (analysis.messageCount < 5) return "대화량이 적어 핵심 흐름 판단이 제한적입니다.";

  const [primary, secondary, tertiary] = themeAnalysis.themes;
  const assets = assetPhrase(analysis.topMentions) || "주요 종목";
  const secondaryPhrase = secondary?.count ? createThemePhrase(secondary) : "다음 거래일 가격 흐름";
  const chatterNote = themeAnalysis.chatterRatio >= 0.35 ? " 잡담 비중도 높아 투자 관련 신호는 선별해서 볼 필요가 있었습니다." : "";

  if (primary?.id === "surge") {
    return `${assets}를 중심으로 급등과 수익 인증·축하 대화가 두드러졌고, ${secondaryPhrase}가 다음 체크포인트로 언급되었습니다.${chatterNote}`;
  }
  if (primary?.id === "crypto") {
    return `${assets}와 비트코인·코인베이스 등 크립토 이슈가 주요 관심사였고, ${secondaryPhrase}를 두고 의견이 이어졌습니다.${chatterNote}`;
  }
  if (primary?.id === "earnings") {
    return `${assets} 관련 실적 발표와 가이던스 기대가 대화를 이끌었고, 발표 이후 대응과 리스크 점검이 함께 언급되었습니다.${chatterNote}`;
  }
  if (primary?.id === "risk") {
    return `${assets} 흐름은 이어졌지만 고점·과열·리스크 우려가 커졌고, 추격 진입보다 대응 타이밍을 보자는 의견이 많았습니다.${chatterNote}`;
  }
  if (primary?.id === "macro") {
    return `금리, FOMC, CPI, 유가와 지정학 이슈가 시장 방향성 논의의 중심이었고, ${assets}의 민감한 반응이 함께 언급되었습니다.${chatterNote}`;
  }
  if (primary?.id === "quantum") {
    return `아이온큐, 리게티, 디웨이브 등 양자 섹터가 주목받았고, 단기 변동성과 장기 테마 지속 여부를 두고 의견이 나뉘었습니다.${chatterNote}`;
  }
  if (primary?.id === "space") {
    return `로켓랩, ASTS 등 우주 섹터 대화가 늘었고, 급등 후 눌림 매수와 리스크를 함께 점검하는 흐름이 있었습니다.${chatterNote}`;
  }
  if (primary?.id === "trading") {
    if (secondary?.id === "quantum") {
      return `${assets} 매매 대응이 활발한 가운데 온큐·리게티 등 양자 섹터 반등과 변동성을 두고 익절·손절 판단이 오갔습니다.${chatterNote}`;
    }
    if (secondary?.id === "macro" && tertiary?.id === "crypto") {
      return `이란·전쟁·유가 같은 매크로 변수와 코인·비트 흐름이 함께 언급되며, ${assets}를 두고 손절·재진입 타이밍을 점검하는 대화가 많았습니다.${chatterNote}`;
    }
    if (secondary?.id === "macro" && tertiary?.id === "earnings") {
      return `CPI와 유가 등 매크로 부담 속에서도 실적·가이던스 기대가 이어졌고, ${assets} 비중 조절과 분할 대응이 주된 화제였습니다.${chatterNote}`;
    }
    if (secondary?.id === "macro") {
      return `매크로 변수 확인을 앞두고 ${assets}의 변동성 대응이 핵심이었으며, 익절·손절·추매 타이밍을 조심스럽게 보는 의견이 많았습니다.${chatterNote}`;
    }
    if (secondary?.id === "surge") {
      return `${assets} 급등 이후 수익 실현과 재진입 여부가 핵심이었고, 축하 분위기와 함께 과열을 경계하는 대화도 이어졌습니다.${chatterNote}`;
    }
    if (secondary?.id === "earnings") {
      return `${assets} 실적 기대를 배경으로 추매와 익절 시점을 저울질하는 대화가 많았고, 발표 이후 방향성이 주요 체크포인트로 남았습니다.${chatterNote}`;
    }
    if (secondary?.id === "crypto") {
      return `코인·비트 흐름을 보면서 ${assets} 매매 대응을 논의하는 분위기였고, 주말 크립토 변동성과 재진입 타이밍이 함께 언급되었습니다.${chatterNote}`;
    }
    return `${assets}를 두고 익절, 손절, 추매, 분할매수 같은 매매 대응 논의가 많았고, 다음 진입 타이밍을 신중히 보자는 흐름이 있었습니다.${chatterNote}`;
  }

  return `${date}에는 ${assets} 관련 대화가 많았지만 특정 사건보다 가격 흐름과 대응 전략을 함께 점검하는 분위기였습니다.${chatterNote}`;
}

function createKeyFlows(analysis, themeAnalysis) {
  const flows = themeAnalysis.themes
    .filter((theme) => theme.count > 0)
    .slice(0, 3)
    .map((theme) => `${theme.label}: ${summarizeTexts(theme.examples, "관련 대화가 일부 언급되었습니다.")}`);

  if (themeAnalysis.chatterRatio >= 0.35) {
    flows.push("잡담 비중 높음: 여행, 음식, 인사 등 일상 대화가 많아 투자 관련 흐름은 분리해서 해석해야 합니다.");
  }

  if (!flows.length && analysis.topMentions.length) {
    flows.push(`${assetPhrase(analysis.topMentions)} 중심으로 가격 흐름과 대응 의견이 오갔습니다.`);
  }

  return flows.slice(0, 4);
}

function countKeywordMatches(text, keywords) {
  return keywords.reduce((count, keyword) => count + (includesKeyword(text, keyword) ? 1 : 0), 0);
}

function createMentionReason(mention) {
  const combined = (mention.keyPoints || []).join(" ");
  const signals = [
    { id: "surge", text: "급등 이후 익절·재진입 여부와 수익 인증이 주로 언급됨", keywords: THEME_DEFINITIONS.find((theme) => theme.id === "surge").keywords },
    { id: "earnings", text: "실적 발표와 가이던스 기대, 발표 이후 주가 반응이 주로 논의됨", keywords: THEME_DEFINITIONS.find((theme) => theme.id === "earnings").keywords },
    { id: "trading", text: "익절·손절·추매 등 매매 대응과 재진입 타이밍 논의가 많았음", keywords: THEME_DEFINITIONS.find((theme) => theme.id === "trading").keywords },
    { id: "risk", text: "고점·과열·리스크 우려와 눌림 여부가 함께 언급됨", keywords: THEME_DEFINITIONS.find((theme) => theme.id === "risk").keywords },
    { id: "macro", text: "금리·유가·전쟁 등 매크로 변수에 따른 변동성 논의가 많았음", keywords: THEME_DEFINITIONS.find((theme) => theme.id === "macro").keywords },
    { id: "crypto", text: "비트코인 흐름과 크립토 법안 기대감에 따른 대응 논의가 많았음", keywords: THEME_DEFINITIONS.find((theme) => theme.id === "crypto").keywords },
    { id: "quantum", text: "양자 섹터 변동성과 장기 테마 지속 여부가 주로 언급됨", keywords: THEME_DEFINITIONS.find((theme) => theme.id === "quantum").keywords },
    { id: "space", text: "우주 섹터 이벤트와 급등 후 눌림·리스크가 함께 언급됨", keywords: THEME_DEFINITIONS.find((theme) => theme.id === "space").keywords }
  ]
    .map((signal) => ({ ...signal, score: countKeywordMatches(combined, signal.keywords) }))
    .sort((a, b) => b.score - a.score);

  const best = signals[0];
  if (best?.score > 0) return best.text.slice(0, 80);

  if (mention.category === "crypto") return "크립토 가격 흐름과 관련 이벤트를 두고 대응 의견이 오갔음";
  if (mention.category === "etf") return "지수·섹터 방향성과 레버리지 대응 관점에서 자주 언급됨";
  if (mention.category === "macro") return "시장 변동성에 영향을 줄 수 있는 매크로 변수로 언급됨";
  return "가격 흐름과 매매 대응 관점에서 반복적으로 언급됨";
}

function createMentionedAssets(topMentions) {
  return topMentions.slice(0, 10).map((mention) => ({
    ticker: mention.ticker,
    category: mention.category || "unknown",
    count: mention.count,
    reason: createMentionReason(mention)
  }));
}

function createDebates(analysis, themeAnalysis) {
  const sentimentConflicts = analysis.topMentions
    .filter((item) => item.sentiment === "혼조")
    .map((item) => ({
      topic: item.ticker,
      pro: "채팅방에서는 상승 또는 매수 관점의 의견이 있었습니다.",
      con: "동시에 고점, 리스크, 관망 또는 매도 관점도 언급되었습니다."
    }));

  if (sentimentConflicts.length) return sentimentConflicts;

  const riskTheme = themeAnalysis.themes.find((theme) => theme.id === "risk");
  const surgeTheme = themeAnalysis.themes.find((theme) => theme.id === "surge");
  if (riskTheme?.count && surgeTheme?.count) {
    return [{
      topic: "추격 진입 여부",
      pro: "급등과 수익 인증이 이어지며 긍정적인 분위기가 있었습니다.",
      con: "고점, 포모, 과열 우려 때문에 진입 타이밍을 조심하자는 의견도 있었습니다."
    }];
  }

  return [];
}

const CHECKPOINT_INCLUDE_KEYWORDS = [
  "실적", "실발", "어닝", "가이던스", "어닝콜", "발표",
  "FOMC", "CPI", "금리", "유가", "환율", "전쟁", "이란", "호르무즈",
  "가격대", "지지", "지지선", "저항", "저항선", "재진입", "손절", "익절", "추매", "분할매수",
  "다음 거래일", "월요일", "화요일", "수요일", "목요일", "금요일", "장전", "장후", "프장", "애프터",
  "비트코인", "비트", "BTC", "80k", "법안", "클래리티", "리플", "코인", "코인베이스"
];

const CHECKPOINT_EXCLUDE_KEYWORDS = [
  "오픈채팅봇", "환영합니다", "들어왔습니다", "나갔습니다", "퇴장",
  "건강", "약", "다이어트", "여행", "음식", "맛집", "점심", "저녁", "아침", "인사",
  "농담", "ㅋㅋ", "ㅎㅎ", "사진", "이모티콘", "삭제된 메시지", "동영상"
];

function isSimpleReaction(text) {
  const normalized = text.replace(/[ㅋㅎㅠㅜ!?.~\s]/g, "");
  return normalized.length <= 2;
}

function isCheckpointCandidate(message) {
  const text = String(message?.text || "").trim();
  if (!text || isSimpleReaction(text)) return false;
  if (CHECKPOINT_EXCLUDE_KEYWORDS.some((keyword) => includesKeyword(text, keyword))) return false;
  return CHECKPOINT_INCLUDE_KEYWORDS.some((keyword) => includesKeyword(text, keyword));
}

function createNextCheckPoints(analysis, themeAnalysis) {
  const points = [];
  const themeIds = new Set(themeAnalysis.themes.filter((theme) => theme.count > 0).map((theme) => theme.id));

  if (themeIds.has("earnings")) points.push("실적 발표, 가이던스, 어닝콜 이후 주가 반응 확인");
  if (themeIds.has("risk") || themeIds.has("surge")) points.push("급등 종목의 과열 여부와 눌림 구간 확인");
  if (themeIds.has("macro")) points.push("금리, FOMC, CPI, 유가, 지정학 이슈에 따른 지수 변동성 확인");
  if (themeIds.has("crypto")) points.push("비트코인 주요 가격대와 코인베이스·크립토 법안 관련 뉴스 확인");
  if (themeIds.has("quantum")) points.push("양자 섹터 주요 종목의 급등 후 변동성 확인");
  if (themeIds.has("space")) points.push("우주 섹터의 발사, 계약, 유상증자 등 이벤트 확인");

  const messagePoints = analysis.checkMessages
    .filter(isCheckpointCandidate)
    .slice(0, 4)
    .map((message) => `${message.time} ${message.text.replace(/\s+/g, " ").slice(0, 120)}`);
  return [...points, ...messagePoints].slice(0, 8);
}

function buildSections(date, messages, analysis, excludedCounts) {
  const themeAnalysis = analyzeThemes(messages);
  const conclusion = createConclusion(date, analysis, themeAnalysis);
  const stockDetails = createStockDetails(messages, analysis.topMentions);
  const keyFlows = createKeyFlows(analysis, themeAnalysis);
  const mentionedAssets = createMentionedAssets(analysis.topMentions);
  const majorDebates = createDebates(analysis, themeAnalysis);
  const nextCheckPoints = createNextCheckPoints(analysis, themeAnalysis);

  return {
    conclusion,
    keyFlows,
    mentionedAssets,
    majorDebates,
    marketMood: {
      summary: keyFlows.length ? keyFlows.join(" / ") : `${analysis.messageCount}개 일반 메시지를 기준으로 흐름을 분류했습니다.`,
      sentiment: analysis.roomSentiment,
      evidence: `상승성 표현 ${analysis.positiveHits}건, 하락성 표현 ${analysis.negativeHits}건이 감지되었습니다. 사진/첨부 ${excludedCounts.mediaMessageCount}건, 시스템성 메시지 ${excludedCounts.systemMessageCount}건은 요약 본문에서 제외했습니다.`
    },
    topStocks: analysis.topMentions,
    stockDetails,
    issues: analysis.issueMessages,
    tradingViews: {
      buy: analysis.buyMessages,
      sell: analysis.sellMessages,
      hold: analysis.holdMessages
    },
    risks: analysis.riskMessages,
    riskWarnings: analysis.riskMessages,
    ideas: analysis.ideaMessages,
    conflicts: majorDebates,
    nextCheckPoints
  };
}

function generateDailySummary(date, messages, options = {}) {
  const analysis = analyzeMessages(messages);
  const excludedCounts = {
    systemMessageCount: options.systemMessageCount || 0,
    mediaMessageCount: options.mediaMessageCount || 0
  };
  const enoughMessages = analysis.messageCount >= 3;

  if (!enoughMessages) {
    const conclusion = "대화량이 적어 핵심 흐름 판단이 제한적입니다.";
    return {
      date,
      messageCount: analysis.messageCount,
      excludedCounts,
      status: "insufficient",
      topMentions: analysis.topMentions,
      conclusion,
      sections: {
        conclusion,
        keyFlows: ["대화량이 적어 핵심 흐름 판단이 제한적입니다."],
        mentionedAssets: createMentionedAssets(analysis.topMentions),
        majorDebates: [],
        marketMood: {
          summary: "요약할 대화가 충분하지 않음",
          sentiment: "관망",
          evidence: "해당 날짜의 파싱된 일반 채팅 메시지가 3개 미만입니다."
        },
        topStocks: analysis.topMentions,
        stockDetails: [],
        issues: [],
        tradingViews: { buy: [], sell: [], hold: [] },
        risks: [],
        riskWarnings: [],
        ideas: [],
        conflicts: [],
        nextCheckPoints: []
      }
    };
  }

  const sections = buildSections(date, messages, analysis, excludedCounts);

  return {
    date,
    messageCount: analysis.messageCount,
    excludedCounts,
    status: "completed",
    topMentions: analysis.topMentions,
    conclusion: sections.conclusion,
    sections
  };
}

module.exports = {
  generateDailySummary
};
