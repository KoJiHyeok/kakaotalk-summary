const SYSTEM_PATTERNS = [
  /님이\s*들어왔습니다\.?$/u,
  /님이\s*나갔습니다\.?$/u,
  /님을\s*내보냈습니다\.?$/u,
  /님이\s*퇴장/u,
  /채팅방\s*관리자가\s*메시지를\s*가렸습니다/u,
  /오픈채팅봇/u,
  /^공지[:\s]/u,
  /^\[공지\]/u,
  /관리자에 의해/u,
  /invited|joined|left|removed/i,
  /^notice[:\s]/i
];

const MEDIA_PATTERNS = [
  /^사진$/u,
  /^동영상$/u,
  /^이모티콘$/u,
  /^삭제된 메시지입니다\.?$/u,
  /^메시지가 삭제되었습니다\.?$/u,
  /^음성메시지$/u,
  /^음성 메시지$/u,
  /^파일$/u,
  /^연락처/u,
  /^지도/u,
  /^photo$/i,
  /^video$/i,
  /^sticker$/i,
  /^emoticon$/i,
  /^deleted message\.?$/i,
  /^voice message$/i,
  /^file$/i,
  /^contact/i,
  /^location/i
];

const KOREAN_DATE_LINE_PATTERNS = [
  /^(?:[-=]+\s*)?(?<year>\d{4})\s*년\s*(?<month>\d{1,2})\s*월\s*(?<day>\d{1,2})\s*일(?:\s+[^\d,:[\]]+)?(?:\s*[-=]+)?$/u,
  /^(?:[-=]+\s*)?(?<year>\d{4})[.\-/]\s*(?<month>\d{1,2})[.\-/]\s*(?<day>\d{1,2})\.?(?:\s+[^\d,:[\]]+)?(?:\s*[-=]+)?$/u
];

const ENGLISH_MONTHS = {
  jan: 1, january: 1,
  feb: 2, february: 2,
  mar: 3, march: 3,
  apr: 4, april: 4,
  may: 5,
  jun: 6, june: 6,
  jul: 7, july: 7,
  aug: 8, august: 8,
  sep: 9, sept: 9, september: 9,
  oct: 10, october: 10,
  nov: 11, november: 11,
  dec: 12, december: 12
};

const ENGLISH_DATE_LINE_PATTERNS = [
  /^(?:[-=]+\s*)?(?:mon(?:day)?|tue(?:sday)?|wed(?:nesday)?|thu(?:rsday)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)?,?\s*(?<monthName>[A-Za-z]+)\s+(?<day>\d{1,2}),\s*(?<year>\d{4})(?:\s*[-=]+)?$/i,
  /^(?:[-=]+\s*)?(?<day>\d{1,2})\s+(?<monthName>[A-Za-z]+)\s+(?<year>\d{4})(?:\s*[-=]+)?$/i
];

const PERIOD_PATTERN = "(?:오전|오후|AM|PM|A\\.M\\.|P\\.M\\.)";
const TIME_PATTERN = `(?:(?<periodBefore>${PERIOD_PATTERN})\\s*)?(?<hour>\\d{1,2}):(?<minute>\\d{2})(?:\\s*(?<periodAfter>${PERIOD_PATTERN}))?`;
const BRACKET_MESSAGE_PATTERN = new RegExp(
  `^\\[(?<author>[^\\]]+)\\]\\s*\\[${TIME_PATTERN}\\]\\s*(?<text>.*)$`,
  "iu"
);

const DATE_PART_PATTERNS = [
  String.raw`(?<year>\d{4})\s*년\s*(?<month>\d{1,2})\s*월\s*(?<day>\d{1,2})\s*일`,
  String.raw`(?<year>\d{4})[.\-/]\s*(?<month>\d{1,2})[.\-/]\s*(?<day>\d{1,2})\.?`
];

const INLINE_MESSAGE_PATTERNS = DATE_PART_PATTERNS.map((datePart) => new RegExp(
  `^\\s*${datePart}\\s+${TIME_PATTERN}\\s*,\\s*(?<author>.+?)\\s*:\\s*(?<text>.*)$`,
  "iu"
));

const BRACKET_DATE_MESSAGE_PATTERNS = DATE_PART_PATTERNS.map((datePart) => new RegExp(
  `^\\[\\s*${datePart}\\s+${TIME_PATTERN}\\s*\\]\\s*\\[(?<author>[^\\]]+)\\]\\s*(?<text>.*)$`,
  "iu"
));

const IGNORABLE_HEADER_PATTERNS = [
  /^카카오톡 대화$/u,
  /^저장한 날짜/u,
  /^대화상대/u,
  /^채팅방명/u,
  /^KakaoTalk Chats?$/i,
  /^Saved Date/i,
  /^Date Saved/i,
  /^Chatroom/i
];

/**
 * Parser output contract:
 * - messages: chat messages only, used by analyzer/summarizer.
 * - systemMessages/mediaMessages: excluded from summary body but counted.
 * - allMessages: every parsed dated message with type "chat" | "system" | "media".
 * - skippedLines: unparsed lines; parsing is best-effort and never throws for one bad line.
 * - skippedLineSamples: first 10 skipped lines for upload result preview.
 * - stats: stable numeric counters consumed by storage/server UI.
 */

function pad2(value) {
  return String(value).padStart(2, "0");
}

function formatDate(year, month, day) {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

function normalizeDateLine(line) {
  const trimmed = line.trim();
  for (const pattern of KOREAN_DATE_LINE_PATTERNS) {
    const match = trimmed.match(pattern);
    if (match?.groups) return formatDate(match.groups.year, match.groups.month, match.groups.day);
  }
  for (const pattern of ENGLISH_DATE_LINE_PATTERNS) {
    const match = trimmed.match(pattern);
    const month = ENGLISH_MONTHS[String(match?.groups?.monthName || "").toLowerCase()];
    if (match?.groups && month) return formatDate(match.groups.year, month, match.groups.day);
  }
  return null;
}

function normalizePeriod(period) {
  return String(period || "").replace(/\./g, "").trim().toUpperCase();
}

function normalizeTime(period, hour, minute) {
  let normalizedHour = Number(hour);
  const normalizedPeriod = normalizePeriod(period);

  if (period === "오후" || normalizedPeriod === "PM") {
    if (normalizedHour < 12) normalizedHour += 12;
  }
  if (period === "오전" || normalizedPeriod === "AM") {
    if (normalizedHour === 12) normalizedHour = 0;
  }

  return `${pad2(normalizedHour)}:${pad2(minute)}`;
}

function isSystemMessage(text) {
  return SYSTEM_PATTERNS.some((pattern) => pattern.test(text.trim()));
}

function isMediaMessage(text) {
  return MEDIA_PATTERNS.some((pattern) => pattern.test(text.trim()));
}

function classifyMessageType(text) {
  if (isMediaMessage(text)) return "media";
  if (isSystemMessage(text)) return "system";
  return "chat";
}

function periodFromGroups(groups) {
  return groups.periodBefore || groups.periodAfter || "";
}

function dateFromGroups(groups, fallbackDate) {
  if (groups.year && groups.month && groups.day) return formatDate(groups.year, groups.month, groups.day);
  return fallbackDate;
}

function toMessageFromGroups(groups, fallbackDate) {
  return {
    date: dateFromGroups(groups, fallbackDate),
    time: normalizeTime(periodFromGroups(groups), groups.hour, groups.minute),
    author: groups.author.trim(),
    text: groups.text.trim()
  };
}

function matchFirst(line, patterns) {
  for (const pattern of patterns) {
    const match = line.match(pattern);
    if (match?.groups) return match;
  }
  return null;
}

function parseMessageLine(line, currentDate) {
  const bracket = line.match(BRACKET_MESSAGE_PATTERN);
  if (bracket) {
    if (!currentDate) {
      return {
        missingDate: true,
        raw_text: line,
        author: bracket.groups.author.trim(),
        time: normalizeTime(periodFromGroups(bracket.groups), bracket.groups.hour, bracket.groups.minute),
        text: bracket.groups.text.trim()
      };
    }
    return toMessageFromGroups(bracket.groups, currentDate);
  }

  const inline = matchFirst(line, INLINE_MESSAGE_PATTERNS);
  if (inline) return toMessageFromGroups(inline.groups, null);

  const bracketDate = matchFirst(line, BRACKET_DATE_MESSAGE_PATTERNS);
  if (bracketDate) return toMessageFromGroups(bracketDate.groups, null);

  return null;
}

function finalizeMessage(target, message) {
  if (!message) return;
  const typedMessage = {
    ...message,
    type: message.type || classifyMessageType(message.text),
    raw_text: message.raw_text || `${message.author}: ${message.text}`
  };
  target.push(typedMessage);
}

function skipped(lineNumber, rawText, reason) {
  return { lineNumber, reason, raw_text: rawText };
}

function isIgnorableHeader(line) {
  return IGNORABLE_HEADER_PATTERNS.some((pattern) => pattern.test(line.trim()));
}

function pushStandaloneExcludedMessage(target, date, line, type) {
  target.push({
    date,
    time: null,
    author: null,
    text: line.trim(),
    type,
    raw_text: line
  });
}

function parseKakaoTalkTxt(content) {
  const normalizedContent = String(content || "").replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = normalizedContent.split("\n");
  const allMessages = [];
  const skippedLines = [];
  let currentDate = null;
  let currentMessage = null;

  lines.forEach((rawLine, index) => {
    const lineNumber = index + 1;
    const line = rawLine.trimEnd();
    const trimmed = line.trim();
    if (!trimmed || isIgnorableHeader(trimmed)) return;

    const detectedDate = normalizeDateLine(trimmed);
    if (detectedDate) {
      finalizeMessage(allMessages, currentMessage);
      currentMessage = null;
      currentDate = detectedDate;
      return;
    }

    const parsed = parseMessageLine(line, currentDate);
    if (parsed?.missingDate) {
      finalizeMessage(allMessages, currentMessage);
      currentMessage = null;
      skippedLines.push(skipped(lineNumber, line, "missing_date"));
      return;
    }

    if (parsed) {
      finalizeMessage(allMessages, currentMessage);
      currentMessage = {
        ...parsed,
        type: classifyMessageType(parsed.text),
        raw_text: line
      };
      currentDate = parsed.date;
      return;
    }

    if (currentDate && isMediaMessage(trimmed)) {
      finalizeMessage(allMessages, currentMessage);
      currentMessage = null;
      pushStandaloneExcludedMessage(allMessages, currentDate, line, "media");
      return;
    }

    if (currentDate && isSystemMessage(trimmed)) {
      finalizeMessage(allMessages, currentMessage);
      currentMessage = null;
      pushStandaloneExcludedMessage(allMessages, currentDate, line, "system");
      return;
    }

    if (currentMessage?.type === "chat") {
      currentMessage.text = `${currentMessage.text}\n${trimmed}`;
      currentMessage.raw_text = `${currentMessage.raw_text}\n${line}`;
      return;
    }

    skippedLines.push(skipped(lineNumber, line, currentDate ? "unparsed_line" : "missing_date"));
  });

  finalizeMessage(allMessages, currentMessage);

  const chatMessages = allMessages.filter((message) => message.type === "chat");
  const systemMessages = allMessages.filter((message) => message.type === "system");
  const mediaMessages = allMessages.filter((message) => message.type === "media");
  const datedMessages = allMessages.filter((message) => message.date);

  return {
    messages: chatMessages,
    systemMessages,
    mediaMessages,
    allMessages,
    skippedLines,
    skippedLineSamples: skippedLines.slice(0, 10),
    stats: {
      parsedMessageCount: chatMessages.length,
      systemMessageCount: systemMessages.length,
      mediaMessageCount: mediaMessages.length,
      excludedMessageCount: systemMessages.length + mediaMessages.length,
      skippedLineCount: skippedLines.length,
      detectedDateCount: new Set(datedMessages.map((message) => message.date)).size
    }
  };
}

function groupMessagesByDate(messages) {
  return messages.reduce((groups, message) => {
    if (!groups[message.date]) groups[message.date] = [];
    groups[message.date].push(message);
    return groups;
  }, {});
}

module.exports = {
  parseKakaoTalkTxt,
  groupMessagesByDate,
  normalizeDateLine,
  normalizeTime,
  isSystemMessage,
  isMediaMessage,
  classifyMessageType
};
