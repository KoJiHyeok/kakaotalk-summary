function toDateKey(date = new Date()) {
  const value = date instanceof Date ? date : new Date(date);
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(dateKey, offset) {
  const [year, month, day] = String(dateKey).split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + offset);
  return toDateKey(date);
}

function latestTime(value) {
  const time = Date.parse(value || "");
  return Number.isFinite(time) ? time : 0;
}

function latestSummariesByDate(summaries) {
  const map = new Map();
  (Array.isArray(summaries) ? summaries : []).forEach((summary) => {
    if (!summary?.date || !summary?.id) return;
    const current = map.get(summary.date);
    const currentTime = latestTime(current?.createdAt || current?.uploadedAt || current?.uploadId);
    const nextTime = latestTime(summary.createdAt || summary.uploadedAt || summary.uploadId);
    if (!current || (nextTime && nextTime >= currentTime)) map.set(summary.date, summary);
  });
  return map;
}

function findTodayWatchRecord(watchRecords, todayKey) {
  return (Array.isArray(watchRecords) ? watchRecords : [])
    .filter((record) => record?.latestSummaryDate === todayKey || String(record?.processedAt || "").startsWith(todayKey))
    .sort((a, b) => latestTime(b.processedAt || b.completedAt || b.createdAt) - latestTime(a.processedAt || a.completedAt || a.createdAt))[0] || null;
}

function getTodaySummaryStatus({ summaries = [], watchRecords = [], today = new Date() } = {}) {
  const todayKey = toDateKey(today);
  const byDate = latestSummariesByDate(summaries);
  const summary = byDate.get(todayKey) || null;
  const watchRecord = findTodayWatchRecord(watchRecords, todayKey);
  const watchSummaryId = watchRecord?.latestSummaryDate === todayKey ? watchRecord.latestSummaryId || "" : "";
  const hasSummary = Boolean(summary || watchSummaryId);
  return {
    date: todayKey,
    hasSummary,
    summaryId: watchSummaryId || summary?.id || "",
    summaryDate: summary?.date || todayKey,
    filename: watchRecord?.filename || "",
    processedAt: watchRecord?.processedAt || watchRecord?.completedAt || watchRecord?.createdAt || "",
    status: watchRecord?.status || (summary ? "summary_exists" : "missing")
  };
}

function getRecentSevenDayStatus({ summaries = [], today = new Date() } = {}) {
  const todayKey = toDateKey(today);
  const byDate = latestSummariesByDate(summaries);
  return Array.from({ length: 7 }, (_, index) => {
    const date = addDays(todayKey, -index);
    const summary = byDate.get(date) || null;
    return {
      date,
      hasSummary: Boolean(summary),
      summaryId: summary?.id || "",
      status: summary ? "processed" : "missing"
    };
  });
}

module.exports = {
  toDateKey,
  addDays,
  latestSummariesByDate,
  getTodaySummaryStatus,
  getRecentSevenDayStatus
};
