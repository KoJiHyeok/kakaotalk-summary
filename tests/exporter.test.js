const test = require("node:test");
const assert = require("node:assert/strict");
const {
  createMarkdownExport,
  createTopMentionsCsv,
  createAllTopMentionsCsv,
  csvEscape,
  DISCLAIMER
} = require("../src/exporter");

function sampleRow() {
  return {
    id: "summary-1",
    date: "2026-05-22",
    messageCount: 123,
    topMentions: [
      {
        ticker: "NVDA",
        category: "stock",
        count: 10,
        sentiment: "상승",
        reason: "실적 기대와 장기 보유 관점 논의"
      }
    ],
    conclusion: "채팅방에서는 NVDA 실적 기대가 핵심이라는 의견이 있었다.",
    summary: {
      date: "2026-05-22",
      messageCount: 123,
      conclusion: "채팅방에서는 NVDA 실적 기대가 핵심이라는 의견이 있었다.",
      excludedCounts: { systemMessageCount: 2, mediaMessageCount: 3 },
      sections: {
        marketMood: { sentiment: "상승" },
        conclusion: "채팅방에서는 NVDA 실적 기대가 핵심이라는 의견이 있었다.",
        keyFlows: ["NVDA 실적 기대가 이어짐"],
        topStocks: [
          {
            ticker: "NVDA",
            category: "stock",
            count: 10,
            sentiment: "상승",
            reason: "실적 기대와 장기 보유 관점 논의"
          }
        ],
        mentionedAssets: [
          {
            ticker: "NVDA",
            category: "stock",
            count: 10,
            reason: "실적 기대와 장기 보유 관점 논의"
          }
        ],
        nextCheckPoints: ["어닝 발표 확인"],
        stockDetails: [
          {
            ticker: "NVDA",
            mainOpinions: "실적 기대가 주요 의견",
            positiveReasons: "가이던스 기대",
            negativeReasons: "고점 부담",
            nextCheckPoints: "어닝 발표"
          }
        ],
        majorDebates: [{ topic: "NVDA", pro: "실적 기대", con: "고점 부담" }],
        riskWarnings: ["고점 부담 언급"]
      }
    }
  };
}

test("markdown export includes date conclusion and disclaimer", () => {
  const markdown = createMarkdownExport(sampleRow(), { skippedLineCount: 1 });
  assert.match(markdown, /2026-05-22/);
  assert.match(markdown, /NVDA 실적 기대가 핵심/);
  assert.match(markdown, new RegExp(DISCLAIMER));
  assert.match(markdown, /파싱 실패 수: 1/);
});

test("top mentions CSV includes ticker category and count", () => {
  const csv = createTopMentionsCsv(sampleRow());
  assert.match(csv, /^date,rank,ticker,category,count,sentiment,reason/);
  assert.match(csv, /2026-05-22,1,NVDA,stock,10,상승/);
});

test("CSV escaping preserves commas line breaks and quotes", () => {
  assert.equal(csvEscape('comma, newline\nand "quote"'), '"comma, newline\nand ""quote"""');
  const csv = createAllTopMentionsCsv([
    {
      date: "2026-05-22",
      topMentions: [
        {
          ticker: "COIN",
          category: "stock",
          count: 4,
          sentiment: "혼조",
          reason: '법안 기대, 재진입\n"타이밍" 논의'
        }
      ]
    }
  ]);
  assert.match(csv, /"법안 기대, 재진입\n""타이밍"" 논의"/);
});
