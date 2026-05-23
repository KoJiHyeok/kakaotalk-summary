require("dotenv").config({ quiet: true });

const http = require("http");
const path = require("path");
const { categorizeTicker } = require("./analyzer");
const { processTxtContent } = require("./processor");
const { getWatchStatus, startWatchFolder, WATCH_DIR } = require("./watchService");
const { getTodaySummaryStatus, getRecentSevenDayStatus } = require("./dailyStatus");
const { openFolder } = require("./folderOpener");
const { buildTickerStats, findTickerStats, normalizeTickerQuery } = require("./tickerStats");
const {
  buildAnalyticsSummary,
  buildDailyMessageSeries,
  buildMarketMoodTable,
  buildDailyTopMentions,
  buildGeminiStatusTable
} = require("./analytics");
const { getCollectorStatuses, manualUploadCollector, SAFE_COLLECTION_NOTICE } = require("./collectors");
const { getGeminiConfig, canUseGemini } = require("./geminiClient");
const {
  createMarkdownExport,
  createTopMentionsCsv,
  createAllTopMentionsCsv,
  markdownFilename,
  csvFilename
} = require("./exporter");
const storage = require("./storage");

const PORT = Number(process.env.PORT || 3000);

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

const NAV_ITEMS = [
  ["/", "홈", ["TXT 업로드"]],
  ["/#upload", "업로드", []],
  ["/summaries", "날짜별 요약", ["날짜별 요약", "요약 없음"]],
  ["/watch", "감시 폴더", ["감시 폴더 상태"]],
  ["/tickers", "종목 추이", ["종목/자산 언급 추이", "언급 추이", "티커 없음"]],
  ["/analytics", "분석 대시보드", ["분석 대시보드"]],
  ["/feedback", "피드백", ["요약 피드백"]],
  ["/collectors", "수집 방식", ["Collector 상태"]],
  ["/uploads", "업로드 기록", ["업로드 기록", "업로드 결과", "업로드 없음"]]
];

function activeNavHref(title, options = {}) {
  if (options.activePath) return options.activePath;
  const match = NAV_ITEMS.find(([, , titleHints]) => titleHints.some((hint) => String(title || "").includes(hint)));
  return match ? match[0] : "/";
}

function renderLayout(title, body, options = {}) {
  const activeHref = activeNavHref(title, options);
  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <style>
    :root { color-scheme: light; --ink:#17202a; --muted:#667085; --line:#d8dee8; --bg:#f7f8fb; --panel:#fff; --accent:#1f6feb; --danger:#b42318; --soft:#f4f7fb; --green:#16a34a; --orange:#ea580c; --purple:#7c3aed; --indigo:#4f46e5; }
    * { box-sizing: border-box; }
    body { margin:0; font-family: Arial, "Malgun Gothic", sans-serif; color:var(--ink); background:var(--bg); }
    header { background:#111827; color:#fff; padding:18px 24px; box-shadow:0 10px 32px rgba(15,23,42,.18); }
    header h1 { margin:0; font-size:20px; letter-spacing:0; }
    nav { margin-top:12px; display:flex; gap:8px; flex-wrap:wrap; }
    nav a { color:#dbeafe; text-decoration:none; font-size:14px; border:1px solid transparent; border-radius:999px; padding:7px 10px; }
    nav a:hover, nav a:focus { background:#1f2937; border-color:#334155; outline:none; }
    nav a.active { background:#fff; color:#111827; border-color:#fff; font-weight:800; }
    main { max-width:1120px; width:100%; margin:0 auto; padding:28px 24px; overflow-x:hidden; }
    section, .panel { background:var(--panel); border:1px solid var(--line); border-radius:8px; padding:24px; margin-bottom:22px; max-width:100%; overflow-x:hidden; }
    h2 { margin:0 0 14px; font-size:20px; }
    h3 { margin:24px 0 12px; font-size:17px; }
    p { line-height:1.72; max-width:860px; }
    .muted { color:var(--muted); }
    .grid { display:grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap:14px; }
    .metric { border:1px solid var(--line); border-radius:8px; padding:16px; background:#fbfcff; }
    .metric strong { display:block; font-size:24px; margin-top:4px; }
    form { display:flex; gap:12px; align-items:center; flex-wrap:wrap; }
    input[type="file"] { border:1px solid var(--line); padding:10px; border-radius:8px; background:#fff; max-width:100%; }
    select, textarea { border:1px solid var(--line); border-radius:8px; padding:10px; font-family:inherit; font-size:14px; background:#fff; max-width:100%; }
    textarea { width:100%; min-height:110px; resize:vertical; line-height:1.6; }
    label { display:grid; gap:6px; font-weight:700; }
    button, .button { border:0; background:var(--accent); color:#fff; padding:10px 14px; border-radius:7px; cursor:pointer; text-decoration:none; display:inline-flex; align-items:center; justify-content:center; gap:6px; font-size:14px; font-weight:700; }
    button:hover, .button:hover, button:focus, .button:focus { filter:brightness(.96); outline:3px solid rgba(31,111,235,.18); outline-offset:2px; }
    table { width:100%; min-width:680px; border-collapse:collapse; margin-top:10px; background:#fff; }
    .table-wrapper { width:100%; max-width:100%; overflow-x:auto; -webkit-overflow-scrolling:touch; }
    th, td { border-bottom:1px solid var(--line); padding:13px 12px; text-align:left; vertical-align:top; line-height:1.55; }
    th { background:#f1f5f9; font-weight:700; }
    code { white-space:pre-wrap; word-break:break-word; }
    .notice { border-left:4px solid var(--accent); padding:14px 16px; background:#eef6ff; }
    .warning { border-left-color:var(--danger); background:#fff3f0; }
    .list { margin:8px 0 0; padding-left:18px; }
    .list li { margin:8px 0; line-height:1.62; max-width:900px; }
    .tag, .badge { display:inline-flex; align-items:center; border:1px solid var(--line); border-radius:999px; padding:4px 9px; margin:2px; font-size:12px; background:#fff; font-weight:800; line-height:1.2; white-space:nowrap; }
    .badge-stock { background:#eef6ff; border-color:#b8d7ff; color:#1759a6; }
    .badge-etf { background:#f0fdf4; border-color:#bbf7d0; color:#166534; }
    .badge-crypto { background:#fff7ed; border-color:#fed7aa; color:#9a3412; }
    .badge-macro { background:#f5f3ff; border-color:#ddd6fe; color:#5b21b6; }
    .badge-risk { background:#fff1f2; border-color:#fecdd3; color:#be123c; }
    .badge-gemini { background:#eef2ff; border-color:#c7d2fe; color:#3730a3; }
    .badge-neutral { background:#f8fafc; border-color:#cbd5e1; color:#475569; }
    .badge-unknown { background:#f8fafc; border-color:#cbd5e1; color:#475569; }
    .report-hero { display:grid; gap:18px; max-width:100%; overflow-x:hidden; }
    .page-header { display:grid; gap:14px; margin-bottom:18px; }
    .page-header-top { display:flex; align-items:flex-start; justify-content:space-between; gap:16px; flex-wrap:wrap; }
    .page-title { margin:0; font-size:26px; line-height:1.25; }
    .page-subtitle { margin:8px 0 0; color:var(--muted); max-width:760px; }
    .summary-card { border:1px solid var(--line); border-radius:8px; background:#fff; padding:20px; min-width:0; }
    .summary-card.emphasis { background:#f8fbff; border-color:#bdd7ff; }
    .summary-card.gemini-emphasis { background:linear-gradient(180deg,#f8f7ff 0%,#fff 100%); border-color:#c7d2fe; box-shadow:0 12px 32px rgba(79,70,229,.09); }
    .summary-title { margin:0 0 8px; font-size:14px; color:var(--muted); font-weight:700; }
    .summary-main { font-size:18px; line-height:1.72; margin:0; max-width:900px; }
    .meta-small { color:var(--muted); font-size:12px; line-height:1.5; margin-top:8px; }
    .stats-grid { display:grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap:12px; max-width:100%; }
    .stat { border:1px solid var(--line); border-radius:8px; background:var(--soft); padding:14px; min-width:0; }
    .stat span { display:block; color:var(--muted); font-size:12px; margin-bottom:5px; }
    .stat strong { font-size:20px; overflow-wrap:anywhere; }
    .button-row { display:flex; gap:10px; flex-wrap:wrap; margin:0 0 16px; }
    .button.secondary { background:#475569; }
    .button.outline { background:#fff; color:#1f2937; border:1px solid var(--line); }
    .button.disabled { background:#cbd5e1; color:#64748b; pointer-events:none; }
    .soft-box { background:#f8fafc; border:1px solid var(--line); border-radius:8px; padding:14px 16px; line-height:1.65; }
    details { border:1px solid var(--line); border-radius:8px; background:#fff; padding:0; margin:16px 0; }
    details > summary { cursor:pointer; padding:16px 18px; font-weight:700; background:#f8fafc; border-radius:8px; }
    details[open] > summary { border-bottom:1px solid var(--line); border-radius:8px 8px 0 0; }
    .details-body { padding:18px; }
    .notice-disclosure { border:0; background:transparent; margin:0 0 18px; }
    .notice-disclosure > summary { display:inline-flex; background:#fff; color:#334155; border:1px solid var(--line); border-radius:999px; padding:7px 11px; font-size:13px; line-height:1.2; }
    .notice-disclosure[open] > summary { background:#f8fafc; color:#111827; border-color:#94a3b8; }
    .notice-modal { max-width:720px; margin-top:12px; border:1px solid var(--line); border-radius:8px; background:#fff; box-shadow:0 18px 50px rgba(15,23,42,.16); padding:20px; }
    .notice-modal h3 { margin-top:0; }
    .notice-modal .button { margin-top:10px; }
    .title-row { display:flex; align-items:flex-start; justify-content:space-between; gap:16px; margin-bottom:14px; }
    .title-row h2 { margin-bottom:0; }
    .title-row .notice-disclosure { flex:0 0 auto; margin:0; position:relative; }
    .title-row .notice-modal { position:absolute; right:0; top:calc(100% + 8px); z-index:20; width:min(520px, calc(100vw - 48px)); margin-top:0; }
    .digest-toolbar { display:grid; gap:14px; margin:16px 0 18px; }
    .toolbar-card { background:#fff; border:1px solid var(--line); border-radius:8px; padding:16px; }
    .search-input { width:100%; border:1px solid var(--line); border-radius:999px; padding:12px 16px; font-size:15px; background:#fff; }
    .filter-chips { display:flex; flex-wrap:wrap; gap:8px; }
    .chip { border:1px solid var(--line); border-radius:999px; padding:8px 12px; background:#fff; color:#334155; cursor:pointer; font-weight:700; }
    .chip.active { background:#111827; color:#fff; border-color:#111827; }
    .no-results { display:none; border:1px dashed var(--line); border-radius:8px; padding:18px; color:var(--muted); background:#fff; }
    .summary-card-grid { display:grid; grid-template-columns:repeat(auto-fit, minmax(280px, 1fr)); gap:16px; max-width:100%; }
    .digest-card { border:1px solid var(--line); border-radius:8px; background:#fff; padding:18px; min-width:0; box-shadow:0 1px 0 rgba(15,23,42,.03); }
    .digest-card:hover { border-color:#b6c2d3; box-shadow:0 12px 30px rgba(15,23,42,.08); }
    .digest-card-header { display:flex; justify-content:space-between; gap:12px; align-items:flex-start; margin-bottom:12px; }
    .digest-date { font-size:18px; font-weight:800; }
    .digest-meta { display:flex; flex-wrap:wrap; gap:7px; color:var(--muted); font-size:13px; margin:8px 0 12px; }
    .digest-badges { display:flex; flex-wrap:wrap; gap:4px; margin:10px 0 12px; }
    .digest-conclusion { background:#f8fafc; border:1px solid var(--line); border-radius:8px; padding:12px; line-height:1.68; margin:12px 0; max-width:none; }
    .line-clamp { display:-webkit-box; -webkit-line-clamp:3; -webkit-box-orient:vertical; overflow:hidden; }
    .digest-actions { margin-top:14px; }
    .quick-card { display:block; border:1px solid var(--line); border-radius:8px; background:#fff; padding:18px; text-decoration:none; color:var(--ink); min-height:120px; }
    .quick-card strong { display:block; font-size:17px; margin-bottom:8px; }
    .quick-card span { display:block; color:var(--muted); line-height:1.6; }
    .quick-card:hover { border-color:#94a3b8; box-shadow:0 8px 24px rgba(15,23,42,.08); }
    .today-status-card { border-color:#c7d2fe; background:#fbfcff; }
    .today-status-card .notice { margin-top:12px; }
    .folder-path { display:block; margin:8px 0 0; padding:10px 12px; border:1px solid var(--line); border-radius:8px; background:#fff; overflow-wrap:anywhere; }
    .recent-day-list { display:grid; gap:8px; margin-top:12px; }
    .recent-day-item { display:flex; justify-content:space-between; gap:12px; align-items:center; border:1px solid var(--line); border-radius:8px; padding:10px 12px; background:#fff; }
    .recent-day-item a { color:var(--accent); font-weight:700; text-decoration:none; }
    .status-pill { display:inline-flex; align-items:center; border-radius:999px; padding:4px 9px; font-size:12px; font-weight:700; border:1px solid var(--line); background:#f8fafc; }
    .status-pill.done { background:#ecfdf3; border-color:#bbf7d0; color:#166534; }
    .status-pill.missing { background:#fff7ed; border-color:#fed7aa; color:#9a3412; }
    .ticker-list { display:grid; gap:12px; }
    .ticker-row { display:grid; grid-template-columns:1fr auto; gap:14px; align-items:center; border:1px solid var(--line); border-radius:8px; padding:14px; background:#fff; }
    .ticker-row strong { font-size:18px; }
    .ticker-meta { display:flex; flex-wrap:wrap; gap:8px; color:var(--muted); font-size:13px; margin-top:7px; }
    .bar-chart { display:grid; gap:10px; margin:14px 0; }
    .bar-row { display:grid; grid-template-columns:96px minmax(0, 1fr) 48px; gap:10px; align-items:center; }
    .bar-track { height:18px; background:#eef2f7; border:1px solid var(--line); border-radius:999px; overflow:hidden; min-width:0; }
    .bar-fill { height:100%; background:linear-gradient(90deg,#1f6feb,#60a5fa); border-radius:999px; min-width:4px; }
    .bar-count { text-align:right; font-weight:700; }
    .section-card { border:1px solid var(--line); border-radius:8px; background:#fff; padding:22px; margin:18px 0; box-shadow:0 1px 0 rgba(15,23,42,.03); }
    .section-card.digest-section { display:grid; grid-template-columns:230px minmax(0, 1fr); gap:24px; align-items:start; }
    .section-card.gemini-section { border-color:#c7d2fe; background:linear-gradient(180deg,#f8f7ff 0%,#fff 55%); }
    .section-kicker { display:block; color:var(--accent); font-size:12px; font-weight:900; letter-spacing:.04em; margin-bottom:6px; }
    .section-card h3 { margin-top:0; }
    .section-meta { display:grid; gap:8px; color:var(--muted); font-size:13px; }
    .section-meta-row { border-top:1px solid var(--line); padding-top:8px; }
    .section-meta-row:first-child { border-top:0; padding-top:0; }
    .section-body { min-width:0; }
    .section-summary { font-size:17px; line-height:1.75; margin:0 0 14px; max-width:850px; }
    .asset-card-grid { display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:12px; }
    .asset-card { border:1px solid var(--line); border-radius:8px; background:#fbfcff; padding:14px; min-width:0; }
    .asset-card h4 { margin:0 0 8px; display:flex; align-items:center; gap:6px; flex-wrap:wrap; }
    .asset-card p { margin:8px 0; max-width:none; line-height:1.6; }
    .mini-card-grid { display:grid; grid-template-columns:repeat(auto-fit, minmax(210px, 1fr)); gap:12px; }
    .mini-card { border:1px solid var(--line); border-radius:8px; background:#f8fafc; padding:13px; line-height:1.62; min-width:0; }
    .glossary-grid { display:grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap:10px; }
    .glossary-item { border:1px solid var(--line); background:#f8fafc; border-radius:8px; padding:12px; line-height:1.55; }
    .glossary-item strong { display:block; margin-bottom:4px; }
    .stock-card { border:1px solid var(--line); border-radius:8px; background:#fbfcff; padding:16px; margin:12px 0; }
    .stock-card h4 { margin:0 0 10px; font-size:16px; }
    .compact p { margin:8px 0; line-height:1.58; max-width:850px; }
    @media (max-width: 720px) {
      main { padding:14px; }
      section, .panel { padding:14px; }
      .title-row { gap:10px; }
      .title-row .notice-modal { width:calc(100vw - 28px); }
      .stats-grid { grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); }
      .section-card.digest-section { grid-template-columns:1fr; gap:14px; }
      .ticker-row { grid-template-columns:1fr; }
      .bar-row { grid-template-columns:82px minmax(0, 1fr) 40px; }
      table { font-size:14px; }
      th, td { padding:8px; }
    }
  </style>
</head>
<body>
  <header>
    <h1>카카오톡 미국주식 오픈채팅방 요약 MVP</h1>
    <nav>
      ${NAV_ITEMS.map(([href, label]) => `<a href="${href}" class="${href === activeHref ? "active" : ""}">${label}</a>`).join("")}
    </nav>
  </header>
  <main>${body}</main>
  <script>
    (function () {
      function applySummaryFilters() {
        var input = document.querySelector('[data-summary-search]');
        var activeChip = document.querySelector('[data-summary-filter].active');
        var rows = Array.from(document.querySelectorAll('[data-summary-row]'));
        var empty = document.querySelector('[data-summary-empty]');
        if (!rows.length) return;
        var query = (input && input.value || '').trim().toLowerCase();
        var filter = activeChip ? activeChip.getAttribute('data-summary-filter') : 'all';
        var visibleCount = 0;
        rows.forEach(function (row) {
          var text = (row.getAttribute('data-search') || '').toLowerCase();
          var categories = (row.getAttribute('data-categories') || '').split(',');
          var matchesQuery = !query || text.indexOf(query) !== -1;
          var matchesFilter = filter === 'all' || categories.indexOf(filter) !== -1;
          var show = matchesQuery && matchesFilter;
          row.style.display = show ? '' : 'none';
          if (show) visibleCount += 1;
        });
        if (empty) empty.style.display = visibleCount ? 'none' : 'block';
      }
      document.addEventListener('input', function (event) {
        if (event.target && event.target.matches('[data-summary-search]')) applySummaryFilters();
      });
      document.addEventListener('click', function (event) {
        var chip = event.target && event.target.closest('[data-summary-filter]');
        if (!chip) return;
        document.querySelectorAll('[data-summary-filter]').forEach(function (item) { item.classList.remove('active'); });
        chip.classList.add('active');
        applySummaryFilters();
      });
    })();
  </script>
</body>
</html>`;
}

function layout(title, body, options = {}) {
  return renderLayout(title, body, options);
}

function response(res, statusCode, html) {
  res.writeHead(statusCode, { "Content-Type": "text/html; charset=utf-8" });
  res.end(html);
}

function downloadResponse(res, filename, contentType, content) {
  res.writeHead(200, {
    "Content-Type": `${contentType}; charset=utf-8`,
    "Content-Disposition": `attachment; filename="${filename}"`,
    "Cache-Control": "no-store"
  });
  res.end(content);
}

function redirect(res, location) {
  res.writeHead(303, { Location: location });
  res.end();
}

function logDetailedError(label, error, context = {}) {
  console.error(`[${new Date().toISOString()}] ${label}`);
  console.error("context:", JSON.stringify(context, null, 2));
  console.error("message:", error?.message || String(error));
  console.error("stack:", error?.stack || "(no stack)");
}

function renderNoticeDisclosure() {
  return `<details class="notice-disclosure">
    <summary>주의 사항</summary>
    <div class="notice-modal">
      <h3>읽기 전 확인</h3>
      <ul class="list">
        <li>이 요약은 카카오톡 대화를 자동 정리한 결과입니다.</li>
        <li>원문 맥락, 발화자 의도, 시간 흐름이 일부 누락될 수 있습니다.</li>
        <li>사진, 이모티콘, 삭제 메시지, 시스템 메시지는 요약 대상에서 제외됩니다.</li>
        <li>이 내용은 투자 조언이 아니라 채팅방 대화 요약입니다.</li>
        <li>실제 투자 판단은 원문 대화와 공식 정보를 함께 확인해 주세요.</li>
      </ul>
      <p class="muted">닫으려면 위의 주의 사항 버튼을 다시 누르세요.</p>
    </div>
  </details>`;
}

function renderPageHeader(title, subtitle = "", actions = "", options = {}) {
  return `<div class="page-header ${options.className || ""}">
    <div class="page-header-top">
      <div>
        <h2 class="page-title">${escapeHtml(title)}</h2>
        ${subtitle ? `<p class="page-subtitle">${escapeHtml(subtitle)}</p>` : ""}
      </div>
      ${actions ? `<div class="button-row">${actions}</div>` : ""}
    </div>
  </div>`;
}

function renderBadge(label, type = "neutral", extra = "") {
  return `<span class="badge badge-${escapeHtml(type || "neutral")}">${escapeHtml(label)}${extra ? ` ${escapeHtml(extra)}` : ""}</span>`;
}

function renderSectionCard(sectionNo, title, meta = [], body = "", options = {}) {
  const metaItems = Array.isArray(meta) ? meta : [];
  const kicker = sectionNo ? `SECTION ${String(sectionNo).padStart(2, "0")}` : options.kicker || "SECTION";
  const metaHtml = metaItems.length
    ? `<aside class="section-meta">
        ${metaItems.map((item) => `<div class="section-meta-row"><strong>${escapeHtml(item.label)}</strong><br>${item.html ? item.value : escapeHtml(item.value ?? "-")}</div>`).join("")}
      </aside>`
    : `<aside class="section-meta"><div class="section-meta-row"><strong>분야</strong><br>${escapeHtml(title)}</div></aside>`;
  return `<div class="section-card digest-section ${options.className || ""}"${options.id ? ` id="${escapeHtml(options.id)}"` : ""}>
    ${metaHtml}
    <div class="section-body">
      <span class="section-kicker">${escapeHtml(kicker)}</span>
      <h3>${escapeHtml(title)}</h3>
      ${options.summary ? `<p class="section-summary">${escapeHtml(options.summary)}</p>` : ""}
      ${body}
    </div>
  </div>`;
}

function renderHome(message = "") {
  const uploads = storage.listUploads().slice(0, 5);
  const geminiConfig = getGeminiConfig();
  const watchStatus = getWatchStatus();
  const todayStatus = getTodaySummaryStatus({
    summaries: storage.listSummaries(),
    watchRecords: watchStatus.recent
  });
  return layout("TXT 업로드", `
    <section>
      <h2>바로가기</h2>
      <div class="grid">
        <a class="quick-card" href="/">
          <strong>TXT 업로드</strong>
          <span>카카오톡에서 내보낸 TXT 파일을 직접 업로드합니다.</span>
        </a>
        <a class="quick-card" href="/summaries">
          <strong>날짜별 요약 보기</strong>
          <span>저장된 날짜별 리포트와 Markdown/CSV 내보내기를 확인합니다.</span>
        </a>
        <a class="quick-card" href="/tickers">
          <strong>종목 언급 추이 보기</strong>
          <span>저장된 요약 데이터 기준으로 티커와 자산의 날짜별 언급량을 확인합니다.</span>
        </a>
        <a class="quick-card" href="/analytics">
          <strong>분석 대시보드</strong>
          <span>전체 기간 메시지 수, 시장 분위기, Gemini 상태, TOP 종목을 한눈에 비교합니다.</span>
        </a>
        <a class="quick-card" href="/feedback">
          <strong>요약 피드백 보기</strong>
          <span>날짜별 요약 품질 평가와 메모를 확인하고 개선 포인트를 모읍니다.</span>
        </a>
        <a class="quick-card" href="/watch">
          <strong>감시 폴더 상태</strong>
          <span>watch 폴더 자동 처리, 성공/실패/중복 기록을 확인합니다.</span>
        </a>
        <a class="quick-card" href="/collectors">
          <strong>Collector 상태 보기</strong>
          <span>현재 지원하는 안전한 수집 방식과 향후 공식 API/웹훅 연결 지점을 확인합니다.</span>
        </a>
        <a class="quick-card" href="/uploads">
          <strong>업로드 기록</strong>
          <span>웹 업로드와 watch 처리 결과를 업로드 단위로 확인합니다.</span>
        </a>
      </div>
      <p class="muted">서버 주소: http://localhost:${PORT} · Gemini: ${canUseGemini(geminiConfig) ? "활성" : "비활성"} · 모델: ${escapeHtml(geminiConfig.model)}</p>
      <p class="muted">Windows 시작 시 자동 실행은 README의 install-startup 스크립트 안내를 참고하세요.</p>
    </section>
    ${renderTodaySummaryStatusCard(todayStatus, watchStatus.watchDir)}
    ${renderLatestWatchSummaryCard(watchStatus)}
    <section id="upload">
      <h2>TXT 파일 업로드</h2>
      ${message}
      <form action="/upload" method="post" enctype="multipart/form-data">
        <input type="file" name="chatFile" accept=".txt,text/plain" required>
        <button type="submit">업로드</button>
      </form>
      <p class="muted">카카오톡 대화 내보내기 TXT 파일을 업로드하면 날짜별로 파싱하고 요약을 저장합니다.</p>
    </section>
    <section>
      <h2>최근 업로드</h2>
      ${uploads.length ? renderUploadTable(uploads) : `<p class="muted">아직 업로드 기록이 없습니다.</p>`}
    </section>
  `);
}

function renderLatestSummaryButton(record, label = "최신 요약 보기") {
  if (!record?.latestSummaryId) return "";
  return `<a class="button" href="/summaries/${escapeHtml(record.latestSummaryId)}">${escapeHtml(label)}</a>`;
}

function renderLatestWatchSummaryCard(status) {
  const record = status?.latestRecord;
  if (!record) {
    return `<section>
      <h2>최근 처리된 요약</h2>
      <p class="muted">아직 watch 폴더 처리 기록이 없습니다.</p>
      <a class="button secondary" href="/watch">감시 폴더 상태 보기</a>
    </section>`;
  }
  return `<section>
    <h2>최근 처리된 요약</h2>
    <div class="soft-box">
      <p><strong>최근 처리 파일:</strong> ${escapeHtml(record.filename)}</p>
      <p><strong>처리 상태:</strong> ${escapeHtml(record.status)}</p>
      <p><strong>최근 요약 날짜:</strong> ${escapeHtml(record.latestSummaryDate || "없음")}</p>
      <div class="button-row">
        ${renderLatestSummaryButton(record)}
        <a class="button secondary" href="/watch">감시 폴더 상태 보기</a>
      </div>
    </div>
  </section>`;
}

function renderOpenWatchFolderButton() {
  return `<a class="button outline" href="/watch/open-folder">watch 폴더 열기</a>`;
}

function renderTodaySummaryStatusCard(status, watchDir) {
  const processedAt = status.processedAt ? new Date(status.processedAt).toLocaleString("ko-KR") : "-";
  const summaryButton = status.summaryId
    ? `<a class="button" href="/summaries/${escapeHtml(status.summaryId)}">오늘 요약 보기</a>`
    : "";
  const missingNotice = status.hasSummary ? "" : `
    <p class="notice warning">아직 오늘 TXT가 처리되지 않았습니다.</p>
    <p class="muted">오늘 카카오톡 TXT가 아직 처리되지 않았습니다. 카카오톡에서 대화 내용을 내보낸 뒤 watch 폴더에 저장해 주세요.</p>
  `;

  return `<section class="today-status-card" data-today-status-card>
    <h2>오늘 요약 상태</h2>
    <div class="stats-grid">
      <div class="stat"><span>오늘 날짜</span><strong>${escapeHtml(status.date)}</strong></div>
      <div class="stat"><span>요약 생성 여부</span><strong>${status.hasSummary ? "생성됨" : "미처리"}</strong></div>
      <div class="stat"><span>오늘 처리된 TXT</span><strong>${escapeHtml(status.filename || "-")}</strong></div>
      <div class="stat"><span>마지막 처리 시각</span><strong>${escapeHtml(processedAt)}</strong></div>
    </div>
    ${missingNotice}
    <div class="button-row">
      ${summaryButton}
      ${renderOpenWatchFolderButton()}
    </div>
    <code class="folder-path">${escapeHtml(watchDir || WATCH_DIR)}</code>
  </section>`;
}

function renderKakaoExportChecklist() {
  return `<details class="kakao-export-checklist" data-kakao-export-checklist>
    <summary>카카오톡 TXT 내보내기 방법</summary>
    <div class="details-body">
      <ol class="list">
        <li>PC 카카오톡에서 미국주식 오픈채팅방 열기</li>
        <li>채팅방 메뉴에서 대화 내용 내보내기 선택</li>
        <li>TXT 파일로 저장</li>
        <li>저장 위치를 watch 폴더로 지정</li>
        <li>잠시 후 /watch에서 처리 결과 확인</li>
        <li>최신 요약 보기 클릭</li>
      </ol>
    </div>
  </details>`;
}

function renderRecentSevenDayStatus(items) {
  return `<div class="summary-card recent-seven-day-status" data-recent-seven-day-status>
    <h2>최근 7일 처리 현황</h2>
    <div class="recent-day-list">
      ${items.map((item) => `<div class="recent-day-item">
        <span>${item.summaryId ? `<a href="/summaries/${escapeHtml(item.summaryId)}">${escapeHtml(item.date)}</a>` : escapeHtml(item.date)}</span>
        <span class="status-pill ${item.hasSummary ? "done" : "missing"}">${item.hasSummary ? "처리 완료" : "처리 없음"}</span>
      </div>`).join("")}
    </div>
  </div>`;
}

function renderUploadTable(uploads) {
  return `<table>
    <thead><tr><th>파일명</th><th>업로드 시간</th><th>상태</th><th>날짜 수</th><th>일반 메시지</th><th>시스템/첨부</th><th>파싱 실패</th><th></th></tr></thead>
    <tbody>
      ${uploads.map((upload) => `<tr>
        <td>${escapeHtml(upload.originalFilename)}</td>
        <td>${escapeHtml(new Date(upload.uploadedAt).toLocaleString("ko-KR"))}</td>
        <td>${escapeHtml(upload.status)}</td>
        <td>${upload.detectedDateCount || 0}</td>
        <td>${upload.parsedMessageCount || 0}</td>
        <td>${upload.excludedMessageCount ?? ((upload.systemMessageCount || 0) + (upload.mediaMessageCount || 0))}</td>
        <td>${upload.skippedLineCount || 0}</td>
        <td><a class="button" href="/uploads/${upload.id}">결과</a></td>
      </tr>`).join("")}
    </tbody>
  </table>`;
}

function renderSkippedSamples(upload) {
  const samples = upload.skippedLineSamples || [];
  if (!upload.skippedLineCount) return "";
  return `
    <details>
      <summary>파싱 실패 줄 예시 ${upload.skippedLineCount || 0}개</summary>
      <div class="details-body">
        <p class="notice warning">일부 줄은 형식이 맞지 않아 제외되었습니다.</p>
        ${samples.length ? `<div class="table-wrapper"><table>
      <thead><tr><th>줄</th><th>사유</th><th>원문</th></tr></thead>
      <tbody>${samples.map((sample) => `<tr>
        <td>${sample.lineNumber}</td>
        <td>${escapeHtml(sample.reason)}</td>
        <td><code>${escapeHtml(sample.raw_text)}</code></td>
      </tr>`).join("")}</tbody>
        </table></div>` : ""}
      </div>
    </details>
  `;
}

function renderFailedSummaries(upload) {
  const failedSummaries = Array.isArray(upload.failedSummaries) ? upload.failedSummaries : [];
  if (!failedSummaries.length) return "";
  return `
    <p class="notice warning">일부 날짜의 요약 생성이 실패했지만, 나머지 날짜는 저장되었습니다.</p>
    <table>
      <thead><tr><th>날짜</th><th>오류</th></tr></thead>
      <tbody>${failedSummaries.map((item) => `<tr>
        <td>${escapeHtml(item.date)}</td>
        <td><code>${escapeHtml(item.errorMessage)}</code></td>
      </tr>`).join("")}</tbody>
    </table>
  `;
}

function renderUploadDetail(uploadId) {
  const upload = storage.getUpload(uploadId);
  if (!upload) return layout("업로드 없음", `<section><h2>업로드 기록을 찾을 수 없습니다.</h2></section>`);
  const summaries = storage.getSummariesByUpload(uploadId);
  const mediaCount = upload.mediaMessageCount || 0;
  const systemCount = upload.systemMessageCount || 0;
  const excludedCount = upload.excludedMessageCount ?? (mediaCount + systemCount);
  return layout("업로드 결과", `
    <section>
      <h2>처리 결과</h2>
      <div class="grid">
        <div class="metric">감지된 날짜 수<strong>${upload.detectedDateCount || 0}</strong></div>
        <div class="metric">파싱된 메시지 수<strong>${upload.parsedMessageCount || 0}</strong></div>
        <div class="metric">시스템/첨부 메시지 수<strong>${excludedCount}</strong></div>
        <div class="metric">파싱 실패 수<strong>${upload.skippedLineCount || 0}</strong></div>
      </div>
      <p class="muted">시스템 메시지 ${systemCount}개, 첨부/미디어 메시지 ${mediaCount}개는 일반 요약 대상에서 제외했습니다.</p>
      <p class="muted">원본 파일명: ${escapeHtml(upload.originalFilename)} · 업로드 시간: ${escapeHtml(new Date(upload.uploadedAt).toLocaleString("ko-KR"))}</p>
      ${renderSkippedSamples(upload)}
      ${renderFailedSummaries(upload)}
    </section>
    <section>
      <h2>날짜별 요약</h2>
      ${summaries.length ? renderSummaryTable(summaries) : `<p class="muted">저장된 요약이 없습니다. 파일 형식을 확인해 주세요.</p>`}
    </section>
  `);
}

function mentionCategory(item) {
  const ticker = String(item?.ticker || "").toUpperCase();
  return item?.category || (ticker ? categorizeTicker(ticker) : "unknown");
}

function rowRiskText(row) {
  const sections = row.summary?.sections || {};
  return [
    row.conclusion,
    ...(Array.isArray(sections.risks) ? sections.risks : []),
    ...(Array.isArray(sections.nextCheckPoints) ? sections.nextCheckPoints : []),
    JSON.stringify(row.summary || {})
  ].filter(Boolean).join(" ").toLowerCase();
}

function summaryCategoryKeys(row) {
  const keys = new Set(["all"]);
  (Array.isArray(row.topMentions) ? row.topMentions : []).forEach((item) => {
    const category = mentionCategory(item);
    if (["stock", "etf", "crypto", "macro"].includes(category)) keys.add(category);
  });
  if (/(리스크|과열|손절|급락|고점|전쟁|유가)/.test(rowRiskText(row))) keys.add("risk");
  return Array.from(keys);
}

function summarySearchText(row) {
  return [
    row.date,
    row.conclusion,
    row.summary?.sections?.marketMood?.sentiment,
    ...(Array.isArray(row.topMentions) ? row.topMentions.map((item) => item.ticker) : [])
  ].filter(Boolean).join(" ");
}

function latestSummariesByDate(summaries) {
  const uploadsById = new Map(storage.listUploads().map((upload) => [upload.id, upload]));
  const latestByDate = new Map();
  summaries.forEach((row) => {
    const upload = uploadsById.get(row.uploadId);
    const timestamp = Date.parse(upload?.uploadedAt || row.createdAt || 0) || 0;
    const current = latestByDate.get(row.date);
    if (!current || timestamp > current.timestamp) latestByDate.set(row.date, { row, timestamp });
  });
  return Array.from(latestByDate.values())
    .map((entry) => entry.row)
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));
}

function countSummaryCategories(summaries) {
  return summaries.reduce((acc, row) => {
    acc.all += 1;
    summaryCategoryKeys(row).forEach((category) => {
      if (category !== "all") acc[category] = (acc[category] || 0) + 1;
    });
    return acc;
  }, { all: 0, stock: 0, etf: 0, crypto: 0, macro: 0, risk: 0 });
}

function renderMentionBadges(mentions, limit = 10) {
  const safeMentions = Array.isArray(mentions) ? mentions.slice(0, limit) : [];
  if (!safeMentions.length) return `<span class="muted">없음</span>`;
  return safeMentions.map((item) => {
    const ticker = escapeHtml(item.ticker || "UNKNOWN");
    const count = Number(item.count || 0);
    const category = mentionCategory(item);
    return `<span class="badge badge-${escapeHtml(category)}">${ticker} ${count}</span>`;
  }).join("");
}

function renderSummaryTable(summaries) {
  return `<div class="table-wrapper"><table>
    <thead><tr><th>날짜</th><th>메시지 수</th><th>대표 종목</th><th>한 줄 결론</th><th></th></tr></thead>
    <tbody>
      ${summaries.map((row) => `<tr data-summary-row data-search="${escapeHtml(summarySearchText(row))}" data-categories="${escapeHtml(summaryCategoryKeys(row).join(","))}">
        <td>${escapeHtml(row.date)}</td>
        <td>${row.messageCount}</td>
        <td>${renderMentionBadges(row.topMentions)}</td>
        <td>${escapeHtml(row.conclusion)}</td>
        <td><a class="button" href="/summaries/${row.id}">상세 보기</a></td>
      </tr>`).join("")}
    </tbody>
  </table></div>`;
}

function renderSummaryCards(summaries) {
  return `<div class="summary-card-grid">
    ${summaries.map((row) => {
      const sentiment = row.summary?.sections?.marketMood?.sentiment || "미분류";
      const gemini = row.summary?.geminiSummary;
      const geminiLabel = gemini?.failed ? "Gemini 실패" : gemini ? "Gemini 포함" : "규칙 기반";
      const geminiType = gemini?.failed ? "risk" : gemini ? "gemini" : "neutral";
      return `<article class="digest-card" data-summary-row data-search="${escapeHtml(summarySearchText(row))}" data-categories="${escapeHtml(summaryCategoryKeys(row).join(","))}">
        <div class="digest-card-header">
          <div>
            <div class="digest-date">${escapeHtml(row.date)}</div>
            <div class="digest-meta">
              <span>메시지 ${Number(row.messageCount || 0).toLocaleString("ko-KR")}개</span>
              <span>시장 분위기 ${escapeHtml(sentiment)}</span>
            </div>
          </div>
          ${renderBadge(geminiLabel, geminiType)}
        </div>
        <div class="digest-badges">${renderMentionBadges(row.topMentions, 8)}</div>
        <p class="digest-conclusion line-clamp">${escapeHtml(row.conclusion || "한 줄 결론이 없습니다.")}</p>
        <div class="digest-actions button-row">
          <a class="button" href="/summaries/${row.id}">상세 보기</a>
          <a class="button outline" href="/summaries/${row.id}/export.md">Markdown</a>
          <a class="button outline" href="/summaries/${row.id}/top-mentions.csv">CSV</a>
        </div>
      </article>`;
    }).join("")}
  </div>`;
}

function renderSummaries() {
  const summaries = latestSummariesByDate(storage.listSummaries());
  const counts = countSummaryCategories(summaries);
  const totalMessages = summaries.reduce((sum, row) => sum + Number(row.messageCount || 0), 0);
  const geminiCount = summaries.filter((row) => row.summary?.geminiSummary && !row.summary.geminiSummary.failed).length;
  return layout("날짜별 요약", `
    <section>
      <div class="title-row">
        ${renderPageHeader("날짜별 요약 다이제스트", "저장된 카카오톡 미국주식 오픈채팅방 요약을 날짜별로 확인합니다.")}
        ${renderNoticeDisclosure()}
      </div>
      <div class="stats-grid">
        <div class="stat"><span>정리된 날짜 수</span><strong>${Number(summaries.length || 0).toLocaleString("ko-KR")}</strong></div>
        <div class="stat"><span>전체 메시지 수</span><strong>${Number(totalMessages || 0).toLocaleString("ko-KR")}</strong></div>
        <div class="stat"><span>Gemini 요약 포함</span><strong>${Number(geminiCount || 0).toLocaleString("ko-KR")}</strong></div>
      </div>
      <div class="digest-toolbar">
        <div class="toolbar-card">
          <input class="search-input" type="search" placeholder="종목, 키워드, 이슈 검색" data-summary-search>
        </div>
        <div class="filter-chips">
          <button type="button" class="chip active" data-summary-filter="all">전체 ${counts.all}</button>
          <button type="button" class="chip" data-summary-filter="stock">종목 ${counts.stock}</button>
          <button type="button" class="chip" data-summary-filter="etf">ETF·레버리지 ${counts.etf}</button>
          <button type="button" class="chip" data-summary-filter="crypto">크립토 ${counts.crypto}</button>
          <button type="button" class="chip" data-summary-filter="macro">매크로 ${counts.macro}</button>
          <button type="button" class="chip" data-summary-filter="risk">리스크 ${counts.risk}</button>
        </div>
        <div class="button-row">
          <a class="button" href="/analytics">분석 대시보드</a>
          <a class="button" href="/tickers">종목 추이 보기</a>
          <a class="button outline" href="/summaries/export/top-mentions.csv">전체 TOP 종목 CSV 다운로드</a>
        </div>
      </div>
      <div class="no-results" data-summary-empty>검색 결과가 없습니다</div>
      ${summaries.length ? renderSummaryCards(summaries) : `<p class="muted">아직 저장된 요약이 없습니다.</p>`}
    </section>
  `);
}

function tickerCategoryLabel(category) {
  return {
    stock: "종목",
    etf: "ETF·레버리지",
    crypto: "크립토",
    macro: "매크로",
    unknown: "기타"
  }[category || "unknown"] || "기타";
}

function tickerCategoryHref(category, query) {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (category && category !== "all") params.set("category", category);
  const suffix = params.toString();
  return `/tickers${suffix ? `?${suffix}` : ""}`;
}

function renderTickerToolbar(query, category) {
  const categories = [
    ["all", "전체"],
    ["stock", "종목"],
    ["etf", "ETF·레버리지"],
    ["crypto", "크립토"],
    ["macro", "매크로"]
  ];
  return `<div class="digest-toolbar">
    <form action="/tickers" method="get">
      <input class="search-input" type="search" name="q" value="${escapeHtml(query || "")}" placeholder="티커 또는 별칭 검색: NVDA, 엔비, COIN, 비트, SOXL">
      ${category && category !== "all" ? `<input type="hidden" name="category" value="${escapeHtml(category)}">` : ""}
      <button type="submit">검색</button>
    </form>
    <div class="filter-chips">
      ${categories.map(([key, label]) => `<a class="chip ${category === key ? "active" : ""}" href="${escapeHtml(tickerCategoryHref(key, query))}">${escapeHtml(label)}</a>`).join("")}
    </div>
  </div>`;
}

function renderTickerTrendChart(stat) {
  const dates = Array.isArray(stat?.dates) ? stat.dates : [];
  if (!dates.length) return `<p class="muted">날짜별 언급 데이터가 없습니다.</p>`;
  const max = Math.max(...dates.map((item) => Number(item.count || 0)), 1);
  return `<div class="bar-chart">
    ${dates.map((item) => {
      const count = Number(item.count || 0);
      const width = Math.max(4, Math.round((count / max) * 100));
      return `<div class="bar-row">
        <span>${escapeHtml(item.date)}</span>
        <div class="bar-track"><div class="bar-fill" style="width:${width}%"></div></div>
        <span class="bar-count">${count}</span>
      </div>`;
    }).join("")}
  </div>`;
}

function renderTickerOverview(stat) {
  return `<div class="summary-card emphasis">
    <p class="summary-title">검색 결과</p>
    <h3>${badge(stat.ticker, stat.category)} 언급 추이</h3>
    <div class="stats-grid">
      <div class="stat"><span>카테고리</span><strong>${escapeHtml(tickerCategoryLabel(stat.category))}</strong></div>
      <div class="stat"><span>전체 언급 수</span><strong>${Number(stat.totalCount || 0).toLocaleString("ko-KR")}</strong></div>
      <div class="stat"><span>언급된 날짜 수</span><strong>${Number(stat.dateCount || 0).toLocaleString("ko-KR")}</strong></div>
      <div class="stat"><span>최근 언급 날짜</span><strong>${escapeHtml(stat.recentDate || "-")}</strong></div>
    </div>
    ${renderTickerTrendChart(stat)}
    <div class="button-row">
      <a class="button" href="/tickers/${encodeURIComponent(stat.ticker)}">상세 보기</a>
    </div>
  </div>`;
}

function renderTickerList(stats) {
  if (!stats.length) return `<p class="muted">조건에 맞는 티커/자산이 없습니다.</p>`;
  return `<div class="ticker-list">
    ${stats.slice(0, 20).map((stat) => `<article class="ticker-row">
      <div>
        <strong>${badge(stat.ticker, stat.category)}</strong>
        <div class="ticker-meta">
          <span>전체 ${Number(stat.totalCount || 0).toLocaleString("ko-KR")}회</span>
          <span>${Number(stat.dateCount || 0).toLocaleString("ko-KR")}일 언급</span>
          <span>최근 ${escapeHtml(stat.recentDate || "-")}</span>
          <span>${escapeHtml(tickerCategoryLabel(stat.category))}</span>
        </div>
      </div>
      <a class="button" href="/tickers/${encodeURIComponent(stat.ticker)}">상세 보기</a>
    </article>`).join("")}
  </div>`;
}

function renderTickers(url) {
  const query = url.searchParams.get("q") || "";
  const category = url.searchParams.get("category") || "all";
  const summaries = storage.listSummaries();
  const uploads = storage.listUploads();
  const allStats = buildTickerStats(summaries, { uploads });
  const normalizedQuery = normalizeTickerQuery(query);
  const matched = query ? findTickerStats(summaries, query, { uploads }) : null;
  const filtered = allStats.filter((stat) => {
    const categoryMatch = category === "all" || stat.category === category;
    const queryMatch = !query || stat.ticker.includes(normalizedQuery) || stat.ticker === matched?.ticker;
    return categoryMatch && queryMatch;
  });

  return layout("종목/자산 언급 추이", `
    <section>
      <div class="title-row">
        ${renderPageHeader("종목/자산 언급 추이", "저장된 요약의 TOP 종목/자산 데이터를 기반으로 날짜별 언급 흐름을 확인합니다.")}
        <div class="button-row">
          <a class="button outline" href="/summaries">날짜별 요약</a>
          <a class="button outline" href="/analytics">분석 대시보드</a>
        </div>
      </div>
      <p class="muted">저장된 날짜별 요약의 TOP 종목/자산 데이터만 사용합니다. 원본 TXT 전체를 다시 분석하지 않습니다.</p>
      ${renderTickerToolbar(query, category)}
      ${query ? matched ? renderTickerOverview(matched) : `<p class="notice warning">검색한 티커/별칭에 해당하는 저장된 언급 데이터가 없습니다.</p>` : ""}
    </section>
    ${renderSectionCard(1, "많이 언급된 티커 TOP 20", [
      { label: "분야", value: "랭킹" },
      { label: "검색어", value: query || "전체" },
      { label: "카테고리", value: tickerCategoryLabel(category === "all" ? "unknown" : category) }
    ], renderTickerList(filtered))}
  `);
}

function renderTickerDetail(tickerOrAlias) {
  const summaries = storage.listSummaries();
  const uploads = storage.listUploads();
  const stat = findTickerStats(summaries, tickerOrAlias, { uploads });
  if (!stat) {
    return layout("티커 없음", `<section>
      <h2>티커/자산을 찾을 수 없습니다</h2>
      <p class="muted">저장된 요약의 TOP 종목/자산 데이터에 ${escapeHtml(tickerOrAlias)} 언급이 없습니다.</p>
      <a class="button" href="/tickers">종목 추이로 돌아가기</a>
    </section>`);
  }

  return layout(`${stat.ticker} 언급 추이`, `
    <section>
      <div class="title-row">
        ${renderPageHeader(`${stat.ticker} 언급 추이`, "저장된 날짜별 요약의 TOP mentions 기준으로 만든 HTML/CSS bar chart입니다.")}
        <div class="button-row">
          <a class="button outline" href="/tickers">종목 추이 목록</a>
          <a class="button outline" href="/analytics">분석 대시보드</a>
        </div>
      </div>
      <div class="stats-grid">
        <div class="stat"><span>티커/자산명</span><strong>${escapeHtml(stat.ticker)}</strong></div>
        <div class="stat"><span>카테고리</span><strong>${escapeHtml(tickerCategoryLabel(stat.category))}</strong></div>
        <div class="stat"><span>전체 언급 수</span><strong>${Number(stat.totalCount || 0).toLocaleString("ko-KR")}</strong></div>
        <div class="stat"><span>언급된 날짜 수</span><strong>${Number(stat.dateCount || 0).toLocaleString("ko-KR")}</strong></div>
        <div class="stat"><span>최근 언급 날짜</span><strong>${escapeHtml(stat.recentDate || "-")}</strong></div>
      </div>
      ${renderTickerTrendChart(stat)}
    </section>
    ${renderSectionCard(1, "날짜별 언급량", [
      { label: "분야", value: "추이" },
      { label: "카테고리", value: renderBadge(tickerCategoryLabel(stat.category), stat.category), html: true },
      { label: "최근 언급", value: stat.recentDate || "-" }
    ], `<div class="table-wrapper"><table>
        <thead><tr><th>날짜</th><th>언급 수</th><th>분위기</th><th>한 줄 결론</th><th></th></tr></thead>
        <tbody>${stat.dates.map((item) => `<tr>
          <td>${escapeHtml(item.date)}</td>
          <td>${Number(item.count || 0).toLocaleString("ko-KR")}</td>
          <td>${escapeHtml(item.sentiment || "-")}</td>
          <td>${escapeHtml(item.conclusion || "-")}</td>
          <td>${item.summaryId ? `<a class="button" href="/summaries/${escapeHtml(item.summaryId)}">요약 보기</a>` : "-"}</td>
        </tr>`).join("")}</tbody>
      </table></div>`)}
  `);
}

function renderAnalyticsMessageChart(series) {
  if (!series.length) return `<p class="muted">분석할 날짜별 메시지 데이터가 없습니다.</p>`;
  const max = Math.max(...series.map((item) => Number(item.messageCount || 0)), 1);
  return `<div class="bar-chart">
    ${series.map((item) => {
      const count = Number(item.messageCount || 0);
      const width = Math.max(4, Math.round((count / max) * 100));
      return `<a class="bar-row" href="/summaries/${escapeHtml(item.summaryId)}" style="text-decoration:none;color:inherit">
        <span>${escapeHtml(item.date)}</span>
        <div class="bar-track"><div class="bar-fill" style="width:${width}%"></div></div>
        <span class="bar-count">${count.toLocaleString("ko-KR")}</span>
      </a>
      <p class="meta-small">제외 ${Number(item.excludedMessageCount || 0).toLocaleString("ko-KR")} · 파싱 실패 ${Number(item.skippedLineCount || 0).toLocaleString("ko-KR")}</p>`;
    }).join("")}
  </div>`;
}

function renderAnalyticsMoodTable(rows) {
  if (!rows.length) return `<p class="muted">시장 분위기 데이터가 없습니다.</p>`;
  return `<div class="table-wrapper"><table>
    <thead><tr><th>날짜</th><th>시장 분위기</th><th>한 줄 결론</th><th>TOP 3 종목/자산</th><th></th></tr></thead>
    <tbody>${rows.map((row) => `<tr>
      <td>${escapeHtml(row.date)}</td>
      <td>${escapeHtml(row.mood || "정보 없음")}</td>
      <td>${escapeHtml(row.conclusion || "-")}</td>
      <td>${row.topMentions.length ? row.topMentions.map((item) => badge(item.ticker, item.category, String(item.count || 0))).join(" ") : "-"}</td>
      <td>${row.summaryId ? `<a class="button" href="/summaries/${escapeHtml(row.summaryId)}">상세 보기</a>` : "-"}</td>
    </tr>`).join("")}</tbody>
  </table></div>`;
}

function renderAnalyticsDailyTopCards(rows) {
  if (!rows.length) return `<p class="muted">날짜별 TOP 종목 데이터가 없습니다.</p>`;
  return `<div class="summary-card-grid">
    ${rows.map((row) => `<article class="digest-card">
      <div class="digest-card-header">
        <div class="digest-date">${escapeHtml(row.date)}</div>
        ${row.summaryId ? `<a class="button outline" href="/summaries/${escapeHtml(row.summaryId)}">요약</a>` : ""}
      </div>
      <div class="digest-badges">${row.topMentions.length ? row.topMentions.map((item) => badge(item.ticker, item.category, String(item.count || 0))).join(" ") : `<span class="muted">TOP 종목 없음</span>`}</div>
    </article>`).join("")}
  </div>`;
}

function renderAnalyticsGeminiTable(rows) {
  if (!rows.length) return `<p class="muted">Gemini 상태 데이터가 없습니다.</p>`;
  return `<div class="table-wrapper"><table>
    <thead><tr><th>날짜</th><th>상태</th><th>모델</th><th>생성 시각</th><th>오류</th><th></th></tr></thead>
    <tbody>${rows.map((row) => `<tr>
      <td>${escapeHtml(row.date)}</td>
      <td>${escapeHtml(row.label)}</td>
      <td>${escapeHtml(row.model || "-")}</td>
      <td>${row.generatedAt ? escapeHtml(new Date(row.generatedAt).toLocaleString("ko-KR")) : "-"}</td>
      <td>${escapeHtml(compactText(row.error || "", 90) || "-")}</td>
      <td>${row.summaryId ? `<a class="button" href="/summaries/${escapeHtml(row.summaryId)}">상세 보기</a>` : "-"}</td>
    </tr>`).join("")}</tbody>
  </table></div>`;
}

function renderAnalyticsTopTickerTable(stats) {
  if (!stats.length) return `<p class="muted">전체 TOP 종목/자산 데이터가 없습니다.</p>`;
  return `<div class="table-wrapper"><table>
    <thead><tr><th>순위</th><th>티커</th><th>카테고리</th><th>전체 언급 수</th><th>언급 날짜 수</th><th>최근 언급일</th><th></th></tr></thead>
    <tbody>${stats.slice(0, 20).map((stat, index) => `<tr>
      <td>${index + 1}</td>
      <td>${badge(stat.ticker, stat.category)}</td>
      <td>${escapeHtml(tickerCategoryLabel(stat.category))}</td>
      <td>${Number(stat.totalCount || 0).toLocaleString("ko-KR")}</td>
      <td>${Number(stat.dateCount || 0).toLocaleString("ko-KR")}</td>
      <td>${escapeHtml(stat.recentDate || "-")}</td>
      <td><a class="button" href="/tickers/${encodeURIComponent(stat.ticker)}">추이 보기</a></td>
    </tr>`).join("")}</tbody>
  </table></div>`;
}

function renderAnalytics() {
  const summaries = storage.listSummaries();
  const uploads = storage.listUploads();
  const summary = buildAnalyticsSummary(summaries, { uploads });
  const messageSeries = buildDailyMessageSeries(summaries, { uploads });
  const moodRows = buildMarketMoodTable(summaries, { uploads });
  const dailyTopRows = buildDailyTopMentions(summaries, { uploads });
  const geminiRows = buildGeminiStatusTable(summaries, { uploads });
  const tickerStats = buildTickerStats(summaries, { uploads });
  const topMentionText = summary.topMention
    ? `${summary.topMention.ticker} ${Number(summary.topMention.totalCount || 0).toLocaleString("ko-KR")}회`
    : "-";
  const busiestText = summary.busiestDate
    ? `${summary.busiestDate.date} ${Number(summary.busiestDate.messageCount || 0).toLocaleString("ko-KR")}개`
    : "-";

  return layout("분석 대시보드", `
    <section>
      <div class="title-row">
        ${renderPageHeader("분석 대시보드", "저장된 날짜별 요약 데이터를 기준으로 전체 기간의 흐름을 비교합니다.")}
        <div class="button-row">
          <a class="button outline" href="/summaries">날짜별 요약</a>
          <a class="button outline" href="/tickers">종목 추이</a>
          <a class="button outline" href="/feedback">요약 피드백</a>
        </div>
      </div>
      <p class="muted">저장된 날짜별 summary와 업로드 메타데이터를 기준으로 전체 기간을 비교합니다. 원본 TXT 전체를 다시 분석하지 않습니다.</p>
      <div class="stats-grid">
        <div class="stat"><span>분석 대상 날짜 수</span><strong>${Number(summary.dateCount || 0).toLocaleString("ko-KR")}</strong></div>
        <div class="stat"><span>전체 메시지 수</span><strong>${Number(summary.totalMessageCount || 0).toLocaleString("ko-KR")}</strong></div>
        <div class="stat"><span>전체 제외 메시지 수</span><strong>${Number(summary.totalExcludedMessageCount || 0).toLocaleString("ko-KR")}</strong></div>
        <div class="stat"><span>전체 파싱 실패 수</span><strong>${Number(summary.totalSkippedLineCount || 0).toLocaleString("ko-KR")}</strong></div>
        <div class="stat"><span>Gemini 요약 생성 날짜 수</span><strong>${Number(summary.geminiGeneratedDateCount || 0).toLocaleString("ko-KR")}</strong></div>
        <div class="stat"><span>가장 대화가 많았던 날짜</span><strong>${escapeHtml(busiestText)}</strong></div>
        <div class="stat"><span>가장 많이 언급된 종목/자산</span><strong>${escapeHtml(topMentionText)}</strong></div>
      </div>
    </section>
    ${renderSectionCard(1, "날짜별 메시지 수", [
      { label: "분야", value: "대화량" },
      { label: "날짜 수", value: `${messageSeries.length}개` },
      { label: "최대 대화량", value: busiestText }
    ], renderAnalyticsMessageChart(messageSeries))}
    ${renderSectionCard(2, "날짜별 시장 분위기", [
      { label: "분야", value: "시장 심리" },
      { label: "행 수", value: `${moodRows.length}개` },
      { label: "연결", value: `<a class="button outline" href="/summaries">요약 목록</a>`, html: true }
    ], renderAnalyticsMoodTable(moodRows))}
    ${renderSectionCard(3, "날짜별 TOP 종목 변화", [
      { label: "분야", value: "종목 변화" },
      { label: "기준", value: "날짜별 TOP 3" },
      { label: "연결", value: `<a class="button outline" href="/tickers">종목 추이</a>`, html: true }
    ], renderAnalyticsDailyTopCards(dailyTopRows))}
    ${renderSectionCard(4, "Gemini 상태 현황", [
      { label: "분야", value: "AI 요약" },
      { label: "Gemini 생성", value: `${summary.geminiGeneratedDateCount || 0}개` },
      { label: "상태", value: renderBadge("Gemini", "gemini"), html: true }
    ], renderAnalyticsGeminiTable(geminiRows))}
    ${renderSectionCard(5, "전체 TOP 종목/자산 순위", [
      { label: "분야", value: "랭킹" },
      { label: "표시 범위", value: "TOP 20" },
      { label: "최상위", value: topMentionText }
    ], renderAnalyticsTopTickerTable(tickerStats))}
  `);
}

function collectorStatusLabel(status) {
  return {
    available: "사용 가능",
    disabled: "비활성",
    not_connected: "미연결",
    unsupported: "지원하지 않음"
  }[status] || status || "알 수 없음";
}

function renderCollectors() {
  const statuses = getCollectorStatuses();
  return layout("Collector 상태", `
    <section>
      <div class="title-row">
        <h2>수집 방식 관리</h2>
        <a class="button outline" href="/">홈으로</a>
      </div>
      <p class="notice">${escapeHtml(SAFE_COLLECTION_NOTICE)}</p>
      <p class="muted">collector 계층은 TXT 문자열을 기존 <code>processTxtContent()</code> 파이프라인으로 넘길 수 있는 안전한 adapter 구조입니다. 현재 자동 처리는 사용자가 직접 저장한 watch 폴더 TXT 파일만 대상으로 합니다.</p>
      <div class="summary-card-grid">
        ${statuses.map((collector) => `<article class="digest-card">
          <div class="digest-card-header">
            <div>
              <div class="digest-date">${escapeHtml(collector.name)}</div>
              <div class="digest-meta">
                <span>${escapeHtml(collector.type)}</span>
                <span>${escapeHtml(collectorStatusLabel(collector.status))}</span>
              </div>
            </div>
            <span class="badge badge-${collector.enabled ? "stock" : "unknown"}">${collector.enabled ? "enabled" : "disabled"}</span>
          </div>
          <p>${escapeHtml(collector.description)}</p>
          <p class="muted">마지막 처리 시각: ${collector.lastCollectedAt ? escapeHtml(new Date(collector.lastCollectedAt).toLocaleString("ko-KR")) : "-"}</p>
          <div class="soft-box">${escapeHtml(collector.safetyNotes || SAFE_COLLECTION_NOTICE)}</div>
        </article>`).join("")}
      </div>
    </section>
  `);
}

function renderUploads() {
  const uploads = storage.listUploads();
  return layout("업로드 기록", `
    <section>
      <h2>업로드 기록</h2>
      ${uploads.length ? renderUploadTable(uploads) : `<p class="muted">아직 업로드 기록이 없습니다.</p>`}
    </section>
  `);
}

function renderWatchStatus() {
  const status = getWatchStatus();
  const rows = status.recent || [];
  const geminiConfig = getGeminiConfig();
  const geminiActive = canUseGemini(geminiConfig);
  const summaries = storage.listSummaries();
  const todayStatus = getTodaySummaryStatus({ summaries, watchRecords: rows });
  const recentSevenDays = getRecentSevenDayStatus({ summaries });
  return layout("감시 폴더 상태", `
    <section>
      <div class="title-row">
        <h2>감시 폴더 상태</h2>
        ${renderNoticeDisclosure()}
      </div>
      <p class="muted">이 기능은 카카오톡 자동 수집이 아니라, 로컬 폴더에 사용자가 넣은 TXT 파일을 자동 처리하는 방식입니다.</p>
      <div class="soft-box">
        <p><strong>사용 방법:</strong> watch 폴더에 카카오톡 TXT 파일을 넣으면 서버가 자동으로 파싱하고 날짜별 요약을 저장합니다.</p>
        <p><strong>처리 완료:</strong> 성공한 파일은 watch/processed 폴더로 이동합니다.</p>
        <p><strong>처리 실패:</strong> 실패한 파일은 watch/failed 폴더로 이동하고 실패 이유를 기록합니다.</p>
        <p><strong>중복 파일:</strong> 이미 처리한 파일은 skipped_duplicate 상태로 기록합니다.</p>
        <p class="muted">Windows 시작 시 자동 실행은 README의 install-startup 스크립트 안내를 참고하세요.</p>
      </div>
      ${renderTodaySummaryStatusCard(todayStatus, status.watchDir)}
      ${renderKakaoExportChecklist()}
      ${renderWatchLatestResult(status)}
      <div class="stats-grid">
        <div class="stat"><span>감시 폴더</span><strong>${escapeHtml(status.watchDir)}</strong></div>
        <div class="stat"><span>처리 완료</span><strong>${status.processedCount}</strong></div>
        <div class="stat"><span>중복 제외</span><strong>${status.duplicateCount}</strong></div>
        <div class="stat"><span>실패 파일</span><strong>${status.failedCount}</strong></div>
        <div class="stat"><span>마지막 처리</span><strong>${status.lastProcessedAt ? escapeHtml(new Date(status.lastProcessedAt).toLocaleString("ko-KR")) : "없음"}</strong></div>
        <div class="stat"><span>Gemini 상태</span><strong>${geminiActive ? "활성" : "비활성"}</strong></div>
        <div class="stat"><span>Gemini 모델</span><strong>${escapeHtml(geminiConfig.model)}</strong></div>
      </div>
      <div class="soft-box">
        <p><strong>처리 완료 폴더:</strong> ${escapeHtml(status.processedDir)}</p>
        <p><strong>실패 폴더:</strong> ${escapeHtml(status.failedDir)}</p>
      </div>
      ${renderRecentSevenDayStatus(recentSevenDays)}
    </section>
    <section>
      <h2>최근 감시 폴더 처리 기록</h2>
      ${rows.length ? `<div class="table-wrapper"><table>
        <thead><tr><th>파일명</th><th>상태</th><th>처리 시각</th><th>날짜 수</th><th>요약 수</th><th>최신 요약</th><th>메시지</th></tr></thead>
        <tbody>${rows.map((record) => `<tr>
          <td>${escapeHtml(record.filename)}</td>
          <td>${escapeHtml(record.status)}</td>
          <td>${record.processedAt || record.completedAt ? escapeHtml(new Date(record.processedAt || record.completedAt).toLocaleString("ko-KR")) : "-"}</td>
          <td>${record.detectedDateCount || 0}</td>
          <td>${record.summaryCount || 0}</td>
          <td>${record.latestSummaryId ? `<a class="button" href="/summaries/${escapeHtml(record.latestSummaryId)}">${escapeHtml(record.latestSummaryDate || "보기")}</a>` : "-"}</td>
          <td>${escapeHtml(record.errorMessage || "")}</td>
        </tr>`).join("")}</tbody>
      </table></div>` : `<p class="muted">아직 감시 폴더 처리 기록이 없습니다.</p>`}
    </section>
  `);
}

function renderWatchLatestResult(status) {
  const record = status.latestRecord;
  if (!record) {
    return `<div class="summary-card">
      <p class="summary-title">최근 처리 결과</p>
      <p class="muted">아직 watch 폴더 처리 기록이 없습니다.</p>
    </div>`;
  }
  const processedAt = record.processedAt || record.completedAt || record.createdAt || "";
  const failure = record.status === "failed" ? `
    <p class="notice warning">실패 사유: ${escapeHtml(record.errorMessage || "알 수 없는 오류")}</p>
    <p class="muted">실패 파일 위치: ${escapeHtml(status.failedDir)}</p>
    <p class="muted">파일 형식과 인코딩을 확인한 뒤 다시 watch 폴더에 넣어 재시도하세요.</p>
  ` : "";
  const duplicate = record.status === "skipped_duplicate" ? `
    <p class="notice">skipped_duplicate: 이미 처리된 파일과 동일한 해시라 새 요약을 만들지 않았습니다.</p>
  ` : "";
  return `<div class="summary-card emphasis">
    <p class="summary-title">최근 처리 결과</p>
    <div class="stats-grid">
      <div class="stat"><span>파일명</span><strong>${escapeHtml(record.filename)}</strong></div>
      <div class="stat"><span>처리 상태</span><strong>${escapeHtml(record.status)}</strong></div>
      <div class="stat"><span>처리 시각</span><strong>${processedAt ? escapeHtml(new Date(processedAt).toLocaleString("ko-KR")) : "-"}</strong></div>
      <div class="stat"><span>감지 날짜 수</span><strong>${record.detectedDateCount || 0}</strong></div>
      <div class="stat"><span>생성된 요약 수</span><strong>${record.summaryCount || 0}</strong></div>
      <div class="stat"><span>최신 요약 날짜</span><strong>${escapeHtml(record.latestSummaryDate || "없음")}</strong></div>
    </div>
    ${failure}
    ${duplicate}
    <div class="button-row">${renderLatestSummaryButton(record)}</div>
  </div>`;
}

function renderMessageList(items, emptyText) {
  if (!items || !items.length) return `<p class="muted">${escapeHtml(emptyText)}</p>`;
  return `<ul class="list">${items.map((item) => {
    if (typeof item === "string") return `<li>${escapeHtml(item)}</li>`;
    return `<li>${item.time ? `${escapeHtml(item.time)} · ` : ""}${escapeHtml(item.text || item.summary || JSON.stringify(item))}</li>`;
  }).join("")}</ul>`;
}

function renderTextList(items, emptyText) {
  if (!items || !items.length) return `<p class="muted">${escapeHtml(emptyText)}</p>`;
  return `<ul class="list">${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
}

function renderFlexibleList(items, emptyText) {
  if (!items || !items.length) return `<p class="muted">${escapeHtml(emptyText)}</p>`;
  if (typeof items[0] === "string") return renderTextList(items, emptyText);
  return renderMessageList(items, emptyText);
}

function renderMentionedAssets(items) {
  if (!items || !items.length) return `<p class="muted">언급 이유를 분리할 만큼 종목/자산 언급이 충분하지 않습니다.</p>`;
  return `<div class="table-wrapper"><table>
    <thead><tr><th>티커/자산</th><th>분류</th><th>언급 빈도</th><th>언급 이유</th></tr></thead>
    <tbody>${items.map((item) => `<tr>
      <td>${escapeHtml(item.ticker)}</td>
      <td>${escapeHtml(item.category || "unknown")}</td>
      <td>${item.count || 0}</td>
      <td>${escapeHtml(item.reason || "")}</td>
    </tr>`).join("")}</tbody>
  </table></div>`;
}

function renderMentionedAssetCards(items) {
  const topItems = Array.isArray(items) ? items.slice(0, 5) : [];
  if (!topItems.length) return `<p class="muted">언급 이유를 분리할 만큼 종목/자산 언급이 충분하지 않습니다.</p>`;
  return `<div class="asset-card-grid">
    ${topItems.map((item) => {
      const category = item.category || categorizeTicker(item.ticker || "");
      return `<article class="asset-card">
        <h4>${badge(item.ticker || "UNKNOWN", category)} ${renderBadge(categoryLabel(category), category)}</h4>
        <p><strong>언급 수:</strong> ${Number(item.count || 0).toLocaleString("ko-KR")} · <strong>분위기:</strong> ${escapeHtml(item.sentiment || "혼조")}</p>
        <p>${escapeHtml(compactText(item.reason || (item.keyPoints || []).join(" / "), 90))}</p>
        <a class="button outline" href="/tickers/${encodeURIComponent(item.ticker || "")}">추이 보기</a>
      </article>`;
    }).join("")}
  </div>`;
}

function renderTopMentionsRemainderTable(items) {
  const rows = Array.isArray(items) ? items.slice(5, 10) : [];
  if (!rows.length) return "";
  return `<h3>TOP 6~10 요약 표</h3>
    <div class="table-wrapper"><table>
      <thead><tr><th>순위</th><th>티커</th><th>분류</th><th>언급 빈도</th><th>분위기</th><th>핵심 내용</th><th></th></tr></thead>
      <tbody>${rows.map((item, index) => `<tr>
        <td>${index + 6}</td>
        <td>${badge(item.ticker, item.category || "unknown")}</td>
        <td>${escapeHtml(categoryLabel(item.category))}</td>
        <td>${Number(item.count || 0).toLocaleString("ko-KR")}</td>
        <td>${escapeHtml(item.sentiment || "")}</td>
        <td>${escapeHtml(compactText(item.reason || (item.keyPoints || []).join(" / "), 150))}</td>
        <td><a class="button outline" href="/tickers/${encodeURIComponent(item.ticker || "")}">추이 보기</a></td>
      </tr>`).join("")}</tbody>
    </table></div>`;
}

function categoryLabel(category) {
  return {
    stock: "종목",
    etf: "ETF/레버리지",
    crypto: "크립토",
    macro: "매크로",
    unknown: "기타"
  }[category || "unknown"] || "기타";
}

function badge(ticker, category = "unknown", extra = "") {
  return `<span class="badge badge-${escapeHtml(category || "unknown")}">${escapeHtml(ticker)}${extra ? ` ${escapeHtml(extra)}` : ""}</span>`;
}

function compactText(value, max = 170) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

function renderTopBadges(mentions, limit = 5) {
  const items = Array.isArray(mentions) ? mentions.slice(0, limit) : [];
  if (!items.length) return `<span class="muted">없음</span>`;
  return items.map((item) => badge(item.ticker, item.category, String(item.count || 0))).join(" ");
}

function renderGeminiSummary(geminiSummary) {
  if (!geminiSummary) {
    return `<p class="muted meta-small">Gemini 고급 요약이 비활성화되어 있습니다. 현재 리포트는 규칙 기반 요약입니다.</p>`;
  }
  if (geminiSummary.failed) {
    return `<div>
      <p class="notice warning">Gemini 요약 생성 실패: ${escapeHtml(geminiSummary.error || "알 수 없는 오류")}</p>
      <p class="meta-small">모델: ${escapeHtml(geminiSummary.model || "")} · 생성 시각: ${escapeHtml(geminiSummary.generatedAt || "")}</p>
    </div>`;
  }
  if (geminiSummary.parseFailed) {
    return `<div>
      <p class="notice warning">Gemini 응답 JSON 파싱에 실패했습니다. 원문 응답을 보관했습니다.</p>
      <div class="soft-box"><code>${escapeHtml(geminiSummary.rawText || "")}</code></div>
      <p class="meta-small">모델: ${escapeHtml(geminiSummary.model || "")} · 생성 시각: ${escapeHtml(geminiSummary.generatedAt || "")}</p>
    </div>`;
  }
  const topics = Array.isArray(geminiSummary.keyTopics) ? geminiSummary.keyTopics : [];
  const highlights = Array.isArray(geminiSummary.stockHighlights) ? geminiSummary.stockHighlights : [];
  return `<div>
    <p class="summary-main">${escapeHtml(geminiSummary.executiveSummary || "Gemini 요약 내용이 없습니다.")}</p>
    <p class="meta-small">시장 분위기: ${escapeHtml(geminiSummary.marketMood || "")} · 모델: ${escapeHtml(geminiSummary.model || "")} · 생성 시각: ${escapeHtml(geminiSummary.generatedAt || "")}</p>
    <div class="mini-card-grid">
      <div class="mini-card"><strong>주요 이슈</strong>${renderTextList(topics, "Gemini가 핵심 주제를 충분히 분리하지 못했습니다.")}</div>
      <div class="mini-card"><strong>리스크</strong>${renderTextList(geminiSummary.risks || [], "Gemini가 별도 리스크를 충분히 분리하지 못했습니다.")}</div>
      <div class="mini-card"><strong>다음 체크포인트</strong>${renderTextList(geminiSummary.nextCheckpoints || [], "Gemini가 다음 체크포인트를 충분히 분리하지 못했습니다.")}</div>
    </div>
    <h3>종목별 하이라이트</h3>
    ${highlights.length ? `<div class="mini-card-grid">${highlights.map((item) => `<div class="mini-card">
      <strong>${escapeHtml(item.ticker || "UNKNOWN")}</strong>
      <p>${escapeHtml(item.summary || "")}</p>
      <p><strong>긍정:</strong> ${escapeHtml(item.positive || "")}</p>
      <p><strong>부정:</strong> ${escapeHtml(item.negative || "")}</p>
      <p><strong>리스크:</strong> ${escapeHtml(item.risk || "")}</p>
      <p><strong>체크포인트:</strong> ${escapeHtml(item.checkpoint || "")}</p>
    </div>`).join("")}</div>` : `<p class="muted">Gemini 종목별 하이라이트가 없습니다.</p>`}
  </div>`;
}

function renderDateNav(row) {
  const siblings = storage.getSummariesByUpload(row.uploadId);
  const index = siblings.findIndex((item) => item.id === row.id);
  const prev = index > 0 ? siblings[index - 1] : null;
  const next = index >= 0 && index < siblings.length - 1 ? siblings[index + 1] : null;
  return `<div class="button-row">
    ${prev ? `<a class="button secondary" href="/summaries/${prev.id}">이전 날짜 ${escapeHtml(prev.date)}</a>` : `<span class="button disabled">이전 날짜</span>`}
    ${next ? `<a class="button secondary" href="/summaries/${next.id}">다음 날짜 ${escapeHtml(next.date)}</a>` : `<span class="button disabled">다음 날짜</span>`}
    <a class="button" href="/summaries">목록으로 돌아가기</a>
  </div>`;
}

function renderGlossaryDetails() {
  const terms = [
    ["실발", "실적 발표"],
    ["프장", "프리마켓"],
    ["애프터", "장후 거래"],
    ["포모", "FOMO, 상승 기회를 놓칠까 두려워하는 심리"],
    ["익절", "이익 실현"],
    ["손절", "손실 확정 매도"],
    ["추매", "추가 매수"],
    ["평단", "평균 매수가"],
    ["물타기", "평균 단가를 낮추기 위한 추가 매수"],
    ["레버리지", "기초자산 수익률을 배수로 추종하는 상품"],
    ["인버스", "기초자산 하락에 베팅하는 상품"],
    ["FOMC", "미국 연방공개시장위원회"],
    ["CPI", "소비자물가지수"],
    ["가이던스", "기업이 제시하는 향후 실적 전망"],
    ["WTI", "미국 서부텍사스산 원유 가격 지표"]
  ];
  return `<details>
    <summary>용어 보기</summary>
    <div class="details-body glossary-grid">
      ${terms.map(([term, desc]) => `<div class="glossary-item"><strong>${escapeHtml(term)}</strong><span>${escapeHtml(desc)}</span></div>`).join("")}
    </div>
  </details>`;
}

function renderStockDetailCards(details) {
  const items = Array.isArray(details) ? details.slice(0, 5) : [];
  if (!items.length) return `<p class="muted">표시할 종목별 상세 분석이 없습니다.</p>`;
  return items.map((item) => `<div class="stock-card compact">
    <h4>${badge(item.ticker, item.category || "stock")}</h4>
    <p><strong>핵심 의견:</strong> ${escapeHtml(compactText(item.mainOpinions, 190))}</p>
    <p><strong>긍정 근거:</strong> ${escapeHtml(compactText(item.positiveReasons, 150))}</p>
    <p><strong>부정/리스크:</strong> ${escapeHtml(compactText(item.negativeReasons || item.risks, 150))}</p>
    <p><strong>체크포인트:</strong> ${escapeHtml(compactText(item.nextCheckPoints, 150))}</p>
  </div>`).join("");
}

const RATING_OPTIONS = [
  ["good", "좋음"],
  ["mixed", "애매함"],
  ["bad", "별로"]
];

const GEMINI_RATING_OPTIONS = [
  ...RATING_OPTIONS,
  ["not_used", "사용 안 함"]
];

function ratingLabel(value) {
  return {
    good: "좋음",
    mixed: "애매함",
    bad: "별로",
    not_used: "사용 안 함"
  }[value] || "애매함";
}

function renderRatingSelect(name, label, value, options = RATING_OPTIONS) {
  return `<label>${escapeHtml(label)}
    <select name="${escapeHtml(name)}">
      ${options.map(([key, text]) => `<option value="${escapeHtml(key)}"${value === key ? " selected" : ""}>${escapeHtml(text)}</option>`).join("")}
    </select>
  </label>`;
}

function renderFeedbackForm(row) {
  const feedback = storage.getSummaryFeedback(row.id) || {};
  const body = `<form action="/summaries/${escapeHtml(row.id)}/feedback" method="post">
      <div class="grid">
        ${renderRatingSelect("overallRating", "전체 평가", feedback.overallRating || "mixed")}
        ${renderRatingSelect("tickerRating", "핵심 종목 추출", feedback.tickerRating || "mixed")}
        ${renderRatingSelect("conclusionRating", "한 줄 결론", feedback.conclusionRating || "mixed")}
        ${renderRatingSelect("checkpointRating", "체크포인트", feedback.checkpointRating || "mixed")}
        ${renderRatingSelect("geminiRating", "Gemini 요약", feedback.geminiRating || "not_used", GEMINI_RATING_OPTIONS)}
      </div>
      <label>메모
        <textarea name="note" placeholder="요약에서 좋았던 점, 빠진 내용, Gemini 프롬프트 개선 아이디어를 적어주세요.">${escapeHtml(feedback.note || "")}</textarea>
      </label>
      <div class="button-row">
        <button type="submit">피드백 저장</button>
        <a class="button outline" href="/feedback">피드백 목록</a>
      </div>
      ${feedback.updatedAt ? `<p class="meta-small">마지막 저장: ${escapeHtml(new Date(feedback.updatedAt).toLocaleString("ko-KR"))}</p>` : ""}
    </form>`;
  return renderSectionCard(9, "요약 품질 평가", [
    { label: "분야", value: "사용자 피드백" },
    { label: "저장 상태", value: feedback.updatedAt ? "기존 피드백 있음" : "아직 없음" },
    { label: "관리", value: `<a class="button outline" href="/feedback">피드백 목록</a>`, html: true }
  ], body, { id: "feedback" });
}

function feedbackStats(feedbacks) {
  return feedbacks.reduce((acc, feedback) => {
    acc.total += 1;
    if (feedback.overallRating === "good") acc.good += 1;
    if (feedback.overallRating === "mixed") acc.mixed += 1;
    if (feedback.overallRating === "bad") acc.bad += 1;
    if (feedback.geminiRating === "good") acc.geminiGood += 1;
    return acc;
  }, { total: 0, good: 0, mixed: 0, bad: 0, geminiGood: 0 });
}

function feedbackFilterHref(rating) {
  return rating === "all" ? "/feedback" : `/feedback?rating=${encodeURIComponent(rating)}`;
}

function renderFeedbackCards(feedbacks) {
  if (!feedbacks.length) return `<p class="muted">조건에 맞는 피드백이 없습니다.</p>`;
  return `<div class="summary-card-grid">
    ${feedbacks.map((feedback) => `<article class="digest-card">
      <div class="digest-card-header">
        <div>
          <div class="digest-date">${escapeHtml(feedback.date || "-")}</div>
          <div class="digest-meta">
            <span>전체 ${escapeHtml(ratingLabel(feedback.overallRating))}</span>
            <span>핵심 종목 ${escapeHtml(ratingLabel(feedback.tickerRating))}</span>
            <span>Gemini ${escapeHtml(ratingLabel(feedback.geminiRating))}</span>
          </div>
        </div>
        ${renderBadge(ratingLabel(feedback.overallRating), feedback.overallRating === "bad" ? "risk" : feedback.overallRating === "good" ? "stock" : "neutral")}
      </div>
      <p class="digest-conclusion line-clamp">${escapeHtml(feedback.note || "메모가 없습니다.")}</p>
      <div class="button-row">
        <a class="button" href="/summaries/${escapeHtml(feedback.summaryId)}">상세 요약 보기</a>
      </div>
    </article>`).join("")}
  </div>`;
}

function renderFeedbackPage(url) {
  const rating = url.searchParams.get("rating") || "all";
  const feedbacks = storage.listSummaryFeedback();
  const stats = feedbackStats(feedbacks);
  const filtered = rating === "all" ? feedbacks : feedbacks.filter((feedback) => feedback.overallRating === rating);
  const chips = [
    ["all", "전체"],
    ["good", "좋음"],
    ["mixed", "애매함"],
    ["bad", "별로"]
  ];
  return layout("요약 피드백", `
    <section>
      <div class="title-row">
        ${renderPageHeader("요약 피드백", "날짜별 요약 품질 평가와 메모를 모아보는 리포트 관리 화면입니다.")}
        <div class="button-row">
          <a class="button outline" href="/summaries">날짜별 요약</a>
          <a class="button outline" href="/analytics">분석 대시보드</a>
        </div>
      </div>
      <div class="stats-grid">
        <div class="stat"><span>전체 피드백 수</span><strong>${stats.total}</strong></div>
        <div class="stat"><span>좋음 수</span><strong>${stats.good}</strong></div>
        <div class="stat"><span>애매함 수</span><strong>${stats.mixed}</strong></div>
        <div class="stat"><span>별로 수</span><strong>${stats.bad}</strong></div>
        <div class="stat"><span>Gemini 좋음 수</span><strong>${stats.geminiGood}</strong></div>
      </div>
      <div class="filter-chips">
        ${chips.map(([key, label]) => `<a class="chip ${rating === key ? "active" : ""}" href="${escapeHtml(feedbackFilterHref(key))}">${escapeHtml(label)}</a>`).join("")}
      </div>
    </section>
    ${renderSectionCard(1, "피드백 목록", [
      { label: "분야", value: "품질 관리" },
      { label: "필터", value: rating === "all" ? "전체" : ratingLabel(rating) },
      { label: "표시 수", value: `${filtered.length}개` }
    ], renderFeedbackCards(filtered))}
  `);
}

function renderDetail(summaryId) {
  const row = storage.getSummary(summaryId);
  if (!row) return layout("요약 없음", `<section><h2>요약을 찾을 수 없습니다.</h2></section>`);
  const summary = row.summary || {};
  const sections = summary.sections || {};
  const excluded = summary.excludedCounts || { systemMessageCount: 0, mediaMessageCount: 0 };
  const marketMood = sections.marketMood || { summary: "요약 데이터가 없습니다.", sentiment: "관망", evidence: "" };
  const upload = storage.getUpload(row.uploadId) || {};
  const topStocks = Array.isArray(sections.topStocks) ? sections.topStocks : Array.isArray(row.topMentions) ? row.topMentions : [];
  const conclusion = sections.conclusion || summary.conclusion || row.conclusion || "";
  const stockDetails = Array.isArray(sections.stockDetails) ? sections.stockDetails : [];
  const date = summary.date || row.date;
  const excludedCount = (excluded.systemMessageCount || 0) + (excluded.mediaMessageCount || 0);
  const gemini = summary.geminiSummary;
  const geminiStatusLabel = gemini?.failed ? "Gemini 실패" : gemini ? "Gemini 포함" : "비활성";
  const geminiStatusType = gemini?.failed ? "risk" : gemini ? "gemini" : "neutral";
  const topTickersText = topStocks.slice(0, 5).map((item) => item.ticker).filter(Boolean).join(", ") || "없음";

  return layout(`${date} 요약`, `
    ${renderDateNav(row)}

    <section class="report-hero">
      <div class="title-row">
        ${renderPageHeader(`${date} 데일리 리포트`, "카카오톡 TXT 대화를 날짜별로 정리한 미국주식 오픈채팅방 다이제스트입니다.", `
          <a class="button outline" href="/summaries/${row.id}/export.md">Markdown 다운로드</a>
          <a class="button outline" href="/summaries/${row.id}/top-mentions.csv">CSV 다운로드</a>
          <a class="button outline" href="#feedback">피드백 작성</a>
        `)}
        ${renderNoticeDisclosure()}
      </div>

      <div class="stats-grid">
        <div class="stat"><span>날짜</span><strong>${escapeHtml(date)}</strong></div>
        <div class="stat"><span>시장 분위기</span><strong>${escapeHtml(marketMood.sentiment || "관망")}</strong></div>
        <div class="stat"><span>총 메시지 수</span><strong>${row.messageCount || summary.messageCount || 0}</strong></div>
        <div class="stat"><span>제외 메시지 수</span><strong>${excludedCount}</strong></div>
        <div class="stat"><span>파싱 실패 수</span><strong>${upload.skippedLineCount || 0}</strong></div>
        <div class="stat"><span>Gemini 여부</span><strong>${escapeHtml(geminiStatusLabel)}</strong></div>
      </div>

      <div class="summary-card emphasis">
        <p class="summary-title">한 줄 결론</p>
        <p class="summary-main">${escapeHtml(conclusion)}</p>
        <p class="meta-small">TOP 종목/자산: ${escapeHtml(topTickersText)}</p>
      </div>
    </section>

    ${renderSectionCard(1, "Gemini 고급 요약", [
      { label: "분야", value: "AI 맥락 요약" },
      { label: "상태", value: renderBadge(geminiStatusLabel, geminiStatusType), html: true },
      { label: "모델", value: gemini?.model || "-" }
    ], renderGeminiSummary(gemini), { className: "gemini-section" })}

    ${renderSectionCard(2, "오늘의 핵심 흐름", [
      { label: "분야", value: "시장 흐름" },
      { label: "항목 수", value: `${(sections.keyFlows || []).slice(0, 3).length}개` },
      { label: "주요 키워드", value: topTickersText }
    ], `<div class="soft-box">${renderTextList((sections.keyFlows || []).slice(0, 3), "핵심 흐름을 분리할 만큼 투자 관련 대화가 충분하지 않습니다.")}</div>`, { summary: marketMood.summary || "" })}

    ${renderSectionCard(3, "TOP 종목/자산 요약", [
      { label: "분야", value: "종목/ETF/자산" },
      { label: "관련 종목/자산", value: renderTopBadges(topStocks, 5), html: true },
      { label: "항목 수", value: `${topStocks.length}개` }
    ], `${renderMentionedAssetCards(sections.mentionedAssets || topStocks)}${renderTopMentionsRemainderTable(sections.mentionedAssets || topStocks)}`)}

    ${renderSectionCard(4, "다음 거래일 체크포인트", [
      { label: "분야", value: "체크포인트" },
      { label: "항목 수", value: `${(sections.nextCheckPoints || []).length}개` },
      { label: "관련 키워드", value: "실적, 매크로, 가격대, 장전/장후" }
    ], `<div class="soft-box">${renderFlexibleList(sections.nextCheckPoints || [], "다음 거래일 체크 포인트가 명확히 언급되지 않았습니다.")}</div>`)}

    ${renderSectionCard(5, "종목별 상세 분석", [
      { label: "분야", value: "종목 상세" },
      { label: "표시 범위", value: "TOP 5" },
      { label: "관련 종목/자산", value: renderTopBadges(topStocks, 5), html: true }
    ], `<details open>
      <summary>종목별 상세 분석 보기</summary>
      <div class="details-body">${renderStockDetailCards(stockDetails)}</div>
    </details>`)}

    ${renderSectionCard(6, "주요 논쟁", [
      { label: "분야", value: "의견 충돌" },
      { label: "항목 수", value: `${Array.isArray(sections.majorDebates) ? sections.majorDebates.length : 0}개` },
      { label: "관련 종목/자산", value: topTickersText }
    ], `<details>
      <summary>주요 논쟁 펼치기</summary>
      <div class="details-body">
        ${Array.isArray(sections.majorDebates) && sections.majorDebates.length ? `<ul class="list">${sections.majorDebates.map((item) => `<li><strong>${escapeHtml(item.topic)}</strong>: ${escapeHtml(item.pro)} / ${escapeHtml(item.con)}</li>`).join("")}</ul>` : `<p class="muted">뚜렷한 논쟁은 감지되지 않았습니다.</p>`}
      </div>
    </details>`)}

    ${renderSectionCard(7, "리스크 경고", [
      { label: "분야", value: "리스크" },
      { label: "항목 수", value: `${(sections.riskWarnings || sections.risks || []).length}개` },
      { label: "키워드", value: renderBadge("risk", "risk"), html: true }
    ], `<details>
      <summary>리스크 경고 펼치기</summary>
      <div class="details-body">${renderMessageList(sections.riskWarnings || sections.risks || [], "과열, 고점 우려, 실적 리스크 등 명확한 리스크 표현이 제한적입니다.")}</div>
    </details>`)}

    ${renderSectionCard(8, "용어 보기", [
      { label: "분야", value: "용어집" },
      { label: "표시 방식", value: "접기/펼치기" },
      { label: "대상", value: "미국주식방 약어" }
    ], renderGlossaryDetails())}

    ${renderFeedbackForm(row)}

    <section><p class="notice warning">이 내용은 투자 조언이 아니라 카카오톡 채팅방 대화 요약입니다.</p></section>

    ${renderDateNav(row)}
  `);
}

function bufferSplit(buffer, separator) {
  const parts = [];
  let start = 0;
  let index = buffer.indexOf(separator);
  while (index !== -1) {
    parts.push(buffer.subarray(start, index));
    start = index + separator.length;
    index = buffer.indexOf(separator, start);
  }
  parts.push(buffer.subarray(start));
  return parts;
}

function parseMultipart(buffer, contentType) {
  const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  if (!boundaryMatch) throw new Error("multipart boundary를 찾을 수 없습니다.");

  const boundary = Buffer.from(`--${boundaryMatch[1] || boundaryMatch[2]}`);
  const parts = bufferSplit(buffer, boundary);
  const files = {};

  parts.forEach((part) => {
    let clean = part;
    if (clean.subarray(0, 2).toString() === "\r\n") clean = clean.subarray(2);
    if (clean.subarray(clean.length - 2).toString() === "\r\n") clean = clean.subarray(0, clean.length - 2);
    if (clean.toString() === "--" || !clean.length) return;

    const headerEnd = clean.indexOf(Buffer.from("\r\n\r\n"));
    if (headerEnd === -1) return;
    const rawHeaders = clean.subarray(0, headerEnd).toString("utf8");
    const content = clean.subarray(headerEnd + 4);
    const disposition = rawHeaders.match(/content-disposition:\s*form-data;\s*name="([^"]+)"(?:;\s*filename="([^"]*)")?/i);
    if (!disposition || !disposition[2]) return;

    files[disposition[1]] = {
      filename: path.basename(disposition[2]),
      content
    };
  });

  return files;
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

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
        summary: "이 날짜의 요약 생성 중 오류가 발생했습니다.",
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

async function handleUpload(req, res) {
  let uploadContext = {};
  try {
    const contentType = req.headers["content-type"] || "";
    if (!contentType.includes("multipart/form-data")) {
      response(res, 400, renderHome(`<p class="notice warning">TXT 파일 업로드 형식이 올바르지 않습니다.</p>`));
      return;
    }

    const body = await readRequestBody(req);
    const files = parseMultipart(body, contentType);
    const file = files.chatFile;
    if (!file || !file.filename.toLowerCase().endsWith(".txt")) {
      response(res, 400, renderHome(`<p class="notice warning">.txt 파일을 선택해 주세요.</p>`));
      return;
    }

    uploadContext = { filename: file.filename, byteLength: file.content.length };
    const [collection] = await manualUploadCollector.collect({
      fileName: file.filename,
      content: file.content.toString("utf8"),
      metadata: { byteLength: file.content.length }
    });
    const saved = await processTxtContent({
      content: collection.content,
      originalFilename: collection.fileName,
      source: collection.source,
      onDailyError: (error, context) => {
        logDetailedError("Daily summary generation failed", error, {
          ...uploadContext,
          ...context
        });
      }
    });

    redirect(res, `/uploads/${saved.upload.id}`);
  } catch (error) {
    logDetailedError("Upload processing failed", error, uploadContext);
    response(res, 500, renderHome(`<p class="notice warning">요약 생성 중 오류가 발생했습니다. 파일 인코딩과 카카오톡 내보내기 형식을 확인한 뒤 다시 시도해 주세요.</p>`));
  }
}

async function handleSummaryFeedback(req, res, summaryId) {
  try {
    if (!storage.getSummary(summaryId)) {
      response(res, 404, layout("404", `<section><h2>요약을 찾을 수 없습니다.</h2></section>`));
      return;
    }
    const body = await readRequestBody(req);
    const params = new URLSearchParams(body.toString("utf8"));
    storage.saveSummaryFeedback(summaryId, {
      overallRating: params.get("overallRating"),
      tickerRating: params.get("tickerRating"),
      conclusionRating: params.get("conclusionRating"),
      checkpointRating: params.get("checkpointRating"),
      geminiRating: params.get("geminiRating"),
      note: params.get("note") || ""
    });
    redirect(res, `/summaries/${summaryId}#feedback`);
  } catch (error) {
    logDetailedError("Summary feedback save failed", error, { summaryId });
    response(res, 500, layout("피드백 저장 실패", `<section><h2>피드백 저장 중 오류가 발생했습니다.</h2><p>${escapeHtml(error.message || String(error))}</p></section>`));
  }
}

function handleSummaryExport(res, summaryId, format) {
  const row = storage.getSummary(summaryId);
  if (!row) {
    response(res, 404, layout("404", `<section><h2>요약을 찾을 수 없습니다.</h2></section>`));
    return;
  }
  const upload = storage.getUpload(row.uploadId) || {};
  if (format === "markdown") {
    downloadResponse(res, markdownFilename(row), "text/markdown", createMarkdownExport(row, upload));
    return;
  }
  downloadResponse(res, csvFilename(row), "text/csv", createTopMentionsCsv(row));
}

function handleAllTopMentionsExport(res) {
  const summaries = latestSummariesByDate(storage.listSummaries());
  downloadResponse(
    res,
    "kakaotalk-stock-top-mentions-all.csv",
    "text/csv",
    createAllTopMentionsCsv(summaries)
  );
}

async function handleOpenWatchFolder(res) {
  const result = await openFolder(WATCH_DIR);
  const message = result.ok
    ? `<p class="notice">watch 폴더를 파일 탐색기로 열었습니다.</p>`
    : `<p class="notice warning">watch 폴더를 자동으로 열지 못했습니다. 아래 경로를 파일 탐색기에 붙여넣어 주세요.</p><p class="muted">${escapeHtml(result.error || "")}</p>`;
  return response(res, 200, layout("watch 폴더 열기", `
    <section>
      <h2>watch 폴더 열기</h2>
      ${message}
      <code class="folder-path">${escapeHtml(WATCH_DIR)}</code>
      <div class="button-row">
        <a class="button" href="/watch">감시 폴더 상태로 돌아가기</a>
        <a class="button secondary" href="/">홈으로</a>
      </div>
    </section>
  `));
}

async function router(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === "GET" && url.pathname === "/") return response(res, 200, renderHome());
  if (req.method === "GET" && url.pathname === "/uploads") return response(res, 200, renderUploads());
  if (req.method === "GET" && url.pathname === "/watch/open-folder") return handleOpenWatchFolder(res);
  if (req.method === "GET" && url.pathname === "/watch") return response(res, 200, renderWatchStatus());
  if (req.method === "GET" && url.pathname === "/collectors") return response(res, 200, renderCollectors());
  if (req.method === "GET" && url.pathname === "/analytics") return response(res, 200, renderAnalytics());
  if (req.method === "GET" && url.pathname === "/feedback") return response(res, 200, renderFeedbackPage(url));
  if (req.method === "GET" && url.pathname === "/tickers") return response(res, 200, renderTickers(url));
  if (req.method === "GET" && url.pathname.startsWith("/tickers/")) return response(res, 200, renderTickerDetail(decodeURIComponent(url.pathname.split("/")[2] || "")));
  if (req.method === "GET" && url.pathname.startsWith("/uploads/")) return response(res, 200, renderUploadDetail(url.pathname.split("/")[2]));
  if (req.method === "GET" && url.pathname === "/summaries") return response(res, 200, renderSummaries());
  if (req.method === "GET" && url.pathname === "/summaries/export/top-mentions.csv") return handleAllTopMentionsExport(res);
  const exportMatch = url.pathname.match(/^\/summaries\/([^/]+)\/(export\.md|top-mentions\.csv)$/);
  if (req.method === "GET" && exportMatch) {
    return handleSummaryExport(res, exportMatch[1], exportMatch[2] === "export.md" ? "markdown" : "csv");
  }
  const feedbackMatch = url.pathname.match(/^\/summaries\/([^/]+)\/feedback$/);
  if (req.method === "POST" && feedbackMatch) return handleSummaryFeedback(req, res, feedbackMatch[1]);
  if (req.method === "GET" && url.pathname.startsWith("/summaries/")) return response(res, 200, renderDetail(url.pathname.split("/")[2]));
  if (req.method === "POST" && url.pathname === "/upload") return handleUpload(req, res);

  response(res, 404, layout("404", `<section><h2>페이지를 찾을 수 없습니다.</h2></section>`));
}

const server = http.createServer((req, res) => {
  router(req, res).catch((error) => {
    logDetailedError("Unhandled route error", error, { method: req.method, url: req.url });
    response(res, 500, layout("오류", `<section><h2>서버 오류가 발생했습니다.</h2></section>`));
  });
});

if (require.main === module) {
  const watcher = process.env.WATCH_ENABLED === "false" ? null : startWatchFolder();
  if (watcher) server.on("close", () => watcher.stop());
  server.listen(PORT, () => {
    console.log(`KakaoTalk summary MVP running at http://localhost:${PORT}`);
  });
}

module.exports = { server, parseMultipart };
