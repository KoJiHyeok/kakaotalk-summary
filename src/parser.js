const SYSTEM_PATTERNS = [
  /님이 들어왔습니다/u,
  /님이 나갔습니다/u,
  /님을 내보냈습니다/u,
  /님이 퇴장/u,
  /채팅방 관리자가 메시지를 가렸습니다/u,
  /오픈채팅봇/u,
  /^공지[:\s]/u,
  /^\[공지\]/u
];

const MEDIA_PATTERNS = [
  /^사진$/u,
  /^동영상$/u,
  /^이모티콘$/u,
  /^삭제된 메시지입니다\.?$/u,
  /^메시지가 삭제되었습니다\.?$/u,
  /^음성메시지$/u,
  /^파일$/u,
  /^연락처$/u,
  /^지도$/u
];

const DATE_LINE_PATTERNS = [
  /^-+\s*(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일.*-+$/u,
  /^-+\s*(\d{4})[.\-/]\s*(\d{1,2})[.\-/]\s*(\d{1,2})\.?.*-+$/u
];

const BRACKET_MESSAGE_PATTERN = /^\[(?<author>[^\]]+)\]\s*\[(?<period>오전|오후|AM|PM)?\s*(?<hour>\d{1,2}):(?<minute>\d{2})\]\s*(?<text>.*)$/iu;
const INLINE_MESSAGE_PATTERN = /^(?<year>\d{4})[.\-/]\s*(?<month>\d{1,2})[.\-/]\s*(?<day>\d{1,2})\.?\s+(?<period>오전|오후|AM|PM)?\s*(?<hour>\d{1,2}):(?<minute>\d{2}),\s*(?<author>.+?)\s*:\s*(?<text>.*)$/iu;
const BRACKET_DATE_MESSAGE_PATTERN = /^\[(?<year>\d{4})[.\-/]\s*(?<month>\d{1,2})[.\-/]\s*(?<day>\d{1,2})\.?\s+(?<period>오전|오후|AM|PM)?\s*(?<hour>\d{1,2}):(?<minute>\d{2})\]\s*\[(?<author>[^\]]+)\]\s*(?<text>.*)$/iu;

function pad2(value) {
  return String(value).padStart(2, "0");
}

function formatDate(year, month, day) {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

function normalizeDateLine(line) {
  for (const pattern of DATE_LINE_PATTERNS) {
    const match = line.match(pattern);
    if (match) return formatDate(match[1], match[2], match[3]);
  }
  return null;
}

function normalizeTime(period, hour, minute) {
  let normalizedHour = Number(hour);
  const normalizedPeriod = period ? period.toUpperCase() : "";

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

function toMessageFromGroups(groups, date) {
  return {
    date,
    time: normalizeTime(groups.period, groups.hour, groups.minute),
    author: groups.author.trim(),
    text: groups.text.trim()
  };
}

function parseMessageLine(line, currentDate) {
  const bracket = line.match(BRACKET_MESSAGE_PATTERN);
  if (bracket) {
    if (!currentDate) {
      return {
        missingDate: true,
        raw_text: line,
        author: bracket.groups.author.trim(),
        time: normalizeTime(bracket.groups.period, bracket.groups.hour, bracket.groups.minute),
        text: bracket.groups.text.trim()
      };
    }
    return toMessageFromGroups(bracket.groups, currentDate);
  }

  const inline = line.match(INLINE_MESSAGE_PATTERN);
  if (inline) {
    return toMessageFromGroups(
      inline.groups,
      formatDate(inline.groups.year, inline.groups.month, inline.groups.day)
    );
  }

  const bracketDate = line.match(BRACKET_DATE_MESSAGE_PATTERN);
  if (bracketDate) {
    return toMessageFromGroups(
      bracketDate.groups,
      formatDate(bracketDate.groups.year, bracketDate.groups.month, bracketDate.groups.day)
    );
  }

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

function parseKakaoTalkTxt(content) {
  const normalizedContent = content.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = normalizedContent.split("\n");
  const allMessages = [];
  const skippedLines = [];
  let currentDate = null;
  let currentMessage = null;

  lines.forEach((rawLine, index) => {
    const lineNumber = index + 1;
    const line = rawLine.trimEnd();
    if (!line.trim()) return;

    const detectedDate = normalizeDateLine(line.trim());
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

    if (currentDate && isMediaMessage(line.trim())) {
      finalizeMessage(allMessages, currentMessage);
      currentMessage = null;
      allMessages.push({
        date: currentDate,
        time: null,
        author: null,
        text: line.trim(),
        type: "media",
        raw_text: line
      });
      return;
    }

    if (currentMessage?.type === "chat") {
      currentMessage.text = `${currentMessage.text}\n${line.trim()}`;
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
