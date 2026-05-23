const http = require("http");
const path = require("path");
const { categorizeTicker } = require("./analyzer");
const { processTxtContent } = require("./processor");
const { getWatchStatus, startWatchFolder } = require("./watchService");
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

function layout(title, body) {
  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <style>
    :root { color-scheme: light; --ink:#17202a; --muted:#667085; --line:#d8dee8; --bg:#f7f8fb; --panel:#fff; --accent:#1f6feb; --danger:#b42318; --soft:#f4f7fb; }
    * { box-sizing: border-box; }
    body { margin:0; font-family: Arial, "Malgun Gothic", sans-serif; color:var(--ink); background:var(--bg); }
    header { background:#111827; color:#fff; padding:18px 24px; }
    header h1 { margin:0; font-size:20px; letter-spacing:0; }
    nav { margin-top:10px; display:flex; gap:12px; flex-wrap:wrap; }
    nav a { color:#dbeafe; text-decoration:none; font-size:14px; }
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
    button, .button { border:0; background:var(--accent); color:#fff; padding:10px 14px; border-radius:7px; cursor:pointer; text-decoration:none; display:inline-flex; align-items:center; gap:6px; font-size:14px; }
    table { width:100%; min-width:680px; border-collapse:collapse; margin-top:10px; background:#fff; }
    .table-wrapper { width:100%; max-width:100%; overflow-x:auto; -webkit-overflow-scrolling:touch; }
    th, td { border-bottom:1px solid var(--line); padding:13px 12px; text-align:left; vertical-align:top; line-height:1.55; }
    th { background:#f1f5f9; font-weight:700; }
    code { white-space:pre-wrap; word-break:break-word; }
    .notice { border-left:4px solid var(--accent); padding:14px 16px; background:#eef6ff; }
    .warning { border-left-color:var(--danger); background:#fff3f0; }
    .list { margin:8px 0 0; padding-left:18px; }
    .list li { margin:8px 0; line-height:1.62; max-width:900px; }
    .tag, .badge { display:inline-block; border:1px solid var(--line); border-radius:999px; padding:4px 9px; margin:2px; font-size:12px; background:#fff; font-weight:700; }
    .badge-stock { background:#eef6ff; border-color:#b8d7ff; color:#1759a6; }
    .badge-etf { background:#f0fdf4; border-color:#bbf7d0; color:#166534; }
    .badge-crypto { background:#fff7ed; border-color:#fed7aa; color:#9a3412; }
    .badge-macro { background:#f5f3ff; border-color:#ddd6fe; color:#5b21b6; }
    .badge-unknown { background:#f8fafc; border-color:#cbd5e1; color:#475569; }
    .report-hero { display:grid; gap:18px; max-width:100%; overflow-x:hidden; }
    .summary-card { border:1px solid var(--line); border-radius:8px; background:#fff; padding:20px; min-width:0; }
    .summary-card.emphasis { background:#f8fbff; border-color:#bdd7ff; }
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
    .search-input { width:100%; border:1px solid var(--line); border-radius:999px; padding:12px 16px; font-size:15px; background:#fff; }
    .filter-chips { display:flex; flex-wrap:wrap; gap:8px; }
    .chip { border:1px solid var(--line); border-radius:999px; padding:8px 12px; background:#fff; color:#334155; cursor:pointer; font-weight:700; }
    .chip.active { background:#111827; color:#fff; border-color:#111827; }
    .no-results { display:none; border:1px dashed var(--line); border-radius:8px; padding:18px; color:var(--muted); background:#fff; }
    .summary-card-grid { display:grid; grid-template-columns:repeat(auto-fit, minmax(280px, 1fr)); gap:16px; max-width:100%; }
    .digest-card { border:1px solid var(--line); border-radius:8px; background:#fff; padding:18px; min-width:0; box-shadow:0 1px 0 rgba(15,23,42,.03); }
    .digest-card-header { display:flex; justify-content:space-between; gap:12px; align-items:flex-start; margin-bottom:12px; }
    .digest-date { font-size:18px; font-weight:800; }
    .digest-meta { display:flex; flex-wrap:wrap; gap:7px; color:var(--muted); font-size:13px; margin:8px 0 12px; }
    .digest-badges { display:flex; flex-wrap:wrap; gap:4px; margin:10px 0 12px; }
    .digest-conclusion { background:#f8fafc; border:1px solid var(--line); border-radius:8px; padding:12px; line-height:1.68; margin:12px 0; max-width:none; }
    .digest-actions { margin-top:14px; }
    .section-card { border:1px solid var(--line); border-radius:8px; background:#fff; padding:22px; margin:18px 0; box-shadow:0 1px 0 rgba(15,23,42,.03); }
    .section-kicker { display:block; color:var(--accent); font-size:12px; font-weight:800; letter-spacing:.04em; margin-bottom:6px; }
    .section-card h3 { margin-top:0; }
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
      table { font-size:14px; }
      th, td { padding:8px; }
    }
  </style>
</head>
<body>
  <header>
    <h1>카카오톡 미국주식 오픈채팅방 요약 MVP</h1>
    <nav>
      <a href="/">업로드</a>
      <a href="/summaries">날짜별 요약</a>
      <a href="/uploads">업로드 기록</a>
      <a href="/watch">감시 폴더</a>
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

function renderHome(message = "") {
  const uploads = storage.listUploads().slice(0, 5);
  return layout("TXT 업로드", `
    <section>
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
      return `<article class="digest-card" data-summary-row data-search="${escapeHtml(summarySearchText(row))}" data-categories="${escapeHtml(summaryCategoryKeys(row).join(","))}">
        <div class="digest-card-header">
          <div>
            <div class="digest-date">${escapeHtml(row.date)}</div>
            <div class="digest-meta">
              <span>메시지 ${Number(row.messageCount || 0).toLocaleString("ko-KR")}개</span>
              <span>시장 분위기 ${escapeHtml(sentiment)}</span>
            </div>
          </div>
          <span class="badge badge-unknown">${escapeHtml(row.status || "completed")}</span>
        </div>
        <div class="digest-badges">${renderMentionBadges(row.topMentions, 8)}</div>
        <p class="digest-conclusion">${escapeHtml(row.conclusion || "한 줄 결론이 없습니다.")}</p>
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
  return layout("날짜별 요약", `
    <section>
      <div class="title-row">
        <h2>날짜별 요약 목록</h2>
        ${renderNoticeDisclosure()}
      </div>
      <div class="digest-toolbar">
        <input class="search-input" type="search" placeholder="종목, 키워드, 이슈 검색" data-summary-search>
        <div class="filter-chips">
          <button type="button" class="chip active" data-summary-filter="all">전체 ${counts.all}</button>
          <button type="button" class="chip" data-summary-filter="stock">종목 ${counts.stock}</button>
          <button type="button" class="chip" data-summary-filter="etf">ETF·레버리지 ${counts.etf}</button>
          <button type="button" class="chip" data-summary-filter="crypto">크립토 ${counts.crypto}</button>
          <button type="button" class="chip" data-summary-filter="macro">매크로 ${counts.macro}</button>
          <button type="button" class="chip" data-summary-filter="risk">리스크 ${counts.risk}</button>
        </div>
        <div class="button-row">
          <a class="button outline" href="/summaries/export/top-mentions.csv">전체 TOP 종목 CSV 다운로드</a>
        </div>
      </div>
      <div class="no-results" data-summary-empty>검색 결과가 없습니다</div>
      ${summaries.length ? renderSummaryCards(summaries) : `<p class="muted">아직 저장된 요약이 없습니다.</p>`}
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
  return layout("감시 폴더 상태", `
    <section>
      <div class="title-row">
        <h2>감시 폴더 상태</h2>
        ${renderNoticeDisclosure()}
      </div>
      <p class="muted">이 기능은 카카오톡 자동 수집이 아니라, 로컬 폴더에 사용자가 넣은 TXT 파일을 자동 처리하는 방식입니다.</p>
      <div class="stats-grid">
        <div class="stat"><span>감시 폴더</span><strong>${escapeHtml(status.watchDir)}</strong></div>
        <div class="stat"><span>처리 완료</span><strong>${status.processedCount}</strong></div>
        <div class="stat"><span>중복 제외</span><strong>${status.duplicateCount}</strong></div>
        <div class="stat"><span>실패 파일</span><strong>${status.failedCount}</strong></div>
        <div class="stat"><span>마지막 처리</span><strong>${status.lastProcessedAt ? escapeHtml(new Date(status.lastProcessedAt).toLocaleString("ko-KR")) : "없음"}</strong></div>
      </div>
      <div class="soft-box">
        <p><strong>처리 완료 폴더:</strong> ${escapeHtml(status.processedDir)}</p>
        <p><strong>실패 폴더:</strong> ${escapeHtml(status.failedDir)}</p>
      </div>
    </section>
    <section>
      <h2>최근 감시 폴더 처리 기록</h2>
      ${rows.length ? `<div class="table-wrapper"><table>
        <thead><tr><th>파일명</th><th>상태</th><th>완료 시간</th><th>요약</th><th>메시지</th></tr></thead>
        <tbody>${rows.map((record) => `<tr>
          <td>${escapeHtml(record.filename)}</td>
          <td>${escapeHtml(record.status)}</td>
          <td>${record.completedAt ? escapeHtml(new Date(record.completedAt).toLocaleString("ko-KR")) : "-"}</td>
          <td>${record.uploadId ? `<a class="button" href="/uploads/${escapeHtml(record.uploadId)}">결과 보기</a>` : `${record.summaryCount || 0}개`}</td>
          <td>${escapeHtml(record.errorMessage || "")}</td>
        </tr>`).join("")}</tbody>
      </table></div>` : `<p class="muted">아직 감시 폴더 처리 기록이 없습니다.</p>`}
    </section>
  `);
}

function renderMessageList(items, emptyText) {
  if (!items || !items.length) return `<p class="muted">${escapeHtml(emptyText)}</p>`;
  return `<ul class="list">${items.map((item) => `<li>${escapeHtml(item.time)} · ${escapeHtml(item.text)}</li>`).join("")}</ul>`;
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
    return `<p class="muted meta-small">Gemini 고급 요약이 비활성화되어 있습니다.</p>`;
  }
  if (geminiSummary.failed) {
    return `<div class="summary-card">
      <p class="summary-title">Gemini 고급 요약</p>
      <p class="notice warning">Gemini 요약 생성 실패: ${escapeHtml(geminiSummary.error || "알 수 없는 오류")}</p>
      <p class="meta-small">모델: ${escapeHtml(geminiSummary.model || "")} · 생성 시각: ${escapeHtml(geminiSummary.generatedAt || "")}</p>
    </div>`;
  }
  if (geminiSummary.parseFailed) {
    return `<div class="summary-card">
      <p class="summary-title">Gemini 고급 요약</p>
      <p class="notice warning">Gemini 응답 JSON 파싱에 실패했습니다. 원문 응답을 보관했습니다.</p>
      <div class="soft-box"><code>${escapeHtml(geminiSummary.rawText || "")}</code></div>
      <p class="meta-small">모델: ${escapeHtml(geminiSummary.model || "")} · 생성 시각: ${escapeHtml(geminiSummary.generatedAt || "")}</p>
    </div>`;
  }
  const topics = Array.isArray(geminiSummary.keyTopics) ? geminiSummary.keyTopics : [];
  const highlights = Array.isArray(geminiSummary.stockHighlights) ? geminiSummary.stockHighlights : [];
  return `<div class="summary-card emphasis">
    <p class="summary-title">Gemini 고급 요약</p>
    <p class="summary-main">${escapeHtml(geminiSummary.executiveSummary || "Gemini 요약 내용이 없습니다.")}</p>
    <p class="meta-small">시장 분위기: ${escapeHtml(geminiSummary.marketMood || "")} · 모델: ${escapeHtml(geminiSummary.model || "")} · 생성 시각: ${escapeHtml(geminiSummary.generatedAt || "")}</p>
    <h3>핵심 주제</h3>
    ${renderTextList(topics, "Gemini가 핵심 주제를 충분히 분리하지 못했습니다.")}
    <h3>종목별 하이라이트</h3>
    ${highlights.length ? `<div class="grid">${highlights.map((item) => `<div class="soft-box">
      <strong>${escapeHtml(item.ticker || "UNKNOWN")}</strong>
      <p>${escapeHtml(item.summary || "")}</p>
      <p><strong>긍정:</strong> ${escapeHtml(item.positive || "")}</p>
      <p><strong>부정:</strong> ${escapeHtml(item.negative || "")}</p>
      <p><strong>리스크:</strong> ${escapeHtml(item.risk || "")}</p>
      <p><strong>체크포인트:</strong> ${escapeHtml(item.checkpoint || "")}</p>
    </div>`).join("")}</div>` : `<p class="muted">Gemini 종목별 하이라이트가 없습니다.</p>`}
    <h3>리스크</h3>
    ${renderTextList(geminiSummary.risks || [], "Gemini가 별도 리스크를 충분히 분리하지 못했습니다.")}
    <h3>다음 체크포인트</h3>
    ${renderTextList(geminiSummary.nextCheckpoints || [], "Gemini가 다음 체크포인트를 충분히 분리하지 못했습니다.")}
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

function renderDetail(summaryId) {
  const row = storage.getSummary(summaryId);
  if (!row) return layout("요약 없음", `<section><h2>요약을 찾을 수 없습니다.</h2></section>`);
  const summary = row.summary || {};
  const sections = summary.sections || {};
  const excluded = summary.excludedCounts || { systemMessageCount: 0, mediaMessageCount: 0 };
  const marketMood = sections.marketMood || { summary: "요약 데이터가 없습니다.", sentiment: "관망", evidence: "" };
  const upload = storage.getUpload(row.uploadId) || {};
  const topStocks = Array.isArray(sections.topStocks) ? sections.topStocks : Array.isArray(row.topMentions) ? row.topMentions : [];
  const topTableRows = topStocks.slice(0, 10);
  const conclusion = sections.conclusion || summary.conclusion || row.conclusion || "";
  const stockDetails = Array.isArray(sections.stockDetails) ? sections.stockDetails : [];
  const remainingTopRows = topTableRows.slice(5);

  return layout(`${summary.date || row.date} 요약`, `
    ${renderDateNav(row)}
    <div class="button-row">
      <a class="button outline" href="/summaries/${row.id}/export.md">Markdown 다운로드</a>
      <a class="button outline" href="/summaries/${row.id}/top-mentions.csv">CSV 다운로드</a>
    </div>

    <section class="report-hero">
      <div class="title-row">
        <div>
          <h2>${escapeHtml(summary.date || row.date)} 리포트</h2>
          <p class="muted">카카오톡 TXT 대화를 날짜별로 파싱한 규칙 기반 요약입니다.</p>
        </div>
        ${renderNoticeDisclosure()}
      </div>

      <div class="stats-grid">
        <div class="stat"><span>날짜</span><strong>${escapeHtml(summary.date || row.date)}</strong></div>
        <div class="stat"><span>총 메시지 수</span><strong>${row.messageCount || summary.messageCount || 0}</strong></div>
        <div class="stat"><span>제외 메시지 수</span><strong>${(excluded.systemMessageCount || 0) + (excluded.mediaMessageCount || 0)}</strong></div>
        <div class="stat"><span>파싱 실패 수</span><strong>${upload.skippedLineCount || 0}</strong></div>
        <div class="stat"><span>시장 분위기</span><strong>${escapeHtml(marketMood.sentiment || "관망")}</strong></div>
      </div>

      <div class="summary-card emphasis">
        <p class="summary-title">한 줄 결론</p>
        <p class="summary-main">${escapeHtml(conclusion)}</p>
      </div>

      ${renderGeminiSummary(summary.geminiSummary)}

    </section>

    <section>
      <div class="section-card">
      <span class="section-kicker">SECTION 01</span>
      <h3>오늘의 핵심 흐름</h3>
      <div class="soft-box">${renderTextList((sections.keyFlows || []).slice(0, 3), "핵심 흐름을 분리할 만큼 투자 관련 대화가 충분하지 않습니다.")}</div>
      </div>

      <div class="section-card">
      <span class="section-kicker">SECTION 02</span>
      <h3>TOP 종목/자산 요약</h3>
      ${renderMentionedAssets((sections.mentionedAssets || []).slice(0, 5))}
      </div>

      <div class="section-card">
      <span class="section-kicker">SECTION 03</span>
      <h3>다음 거래일 체크포인트</h3>
      <div class="soft-box">${renderFlexibleList(sections.nextCheckPoints || [], "다음 거래일 체크 포인트가 명확히 언급되지 않았습니다.")}</div>
      </div>

      <div class="section-card">
      <span class="section-kicker">SECTION 04</span>
      <details>
        <summary>종목별 상세 분석 TOP 5 펼치기</summary>
        <div class="details-body">${renderStockDetailCards(stockDetails)}</div>
      </details>
      </div>

      ${remainingTopRows.length ? `<h3>TOP 6~10 요약 표</h3>
      <div class="table-wrapper"><table>
        <thead><tr><th>순위</th><th>티커</th><th>분류</th><th>언급 빈도</th><th>분위기</th><th>핵심 내용</th></tr></thead>
        <tbody>${remainingTopRows.map((item, index) => `<tr>
          <td>${index + 6}</td>
          <td>${badge(item.ticker, item.category || "unknown")}</td>
          <td>${escapeHtml(categoryLabel(item.category))}</td>
          <td>${item.count || 0}</td>
          <td>${escapeHtml(item.sentiment || "")}</td>
          <td>${escapeHtml(compactText((item.keyPoints || []).join(" / "), 180))}</td>
        </tr>`).join("")}</tbody>
      </table></div>` : ""}

      <div class="section-card">
      <span class="section-kicker">SECTION 05</span>
      <details>
        <summary>주요 논쟁 펼치기</summary>
        <div class="details-body">
          ${Array.isArray(sections.majorDebates) && sections.majorDebates.length ? `<ul class="list">${sections.majorDebates.map((item) => `<li><strong>${escapeHtml(item.topic)}</strong>: ${escapeHtml(item.pro)} / ${escapeHtml(item.con)}</li>`).join("")}</ul>` : `<p class="muted">뚜렷한 논쟁은 감지되지 않았습니다.</p>`}
        </div>
      </details>
      </div>

      <div class="section-card">
      <span class="section-kicker">SECTION 06</span>
      <details>
        <summary>리스크 경고 펼치기</summary>
        <div class="details-body">${renderMessageList(sections.riskWarnings || sections.risks || [], "과열, 고점 우려, 실적 리스크 등 명확한 리스크 표현이 제한적입니다.")}</div>
      </details>
      </div>

      ${renderGlossaryDetails()}

      <p class="notice warning">이 내용은 투자 조언이 아니라 카카오톡 채팅방 대화 요약입니다.</p>
    </section>

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
    const saved = await processTxtContent({
      content: file.content.toString("utf8"),
      originalFilename: file.filename,
      source: "web_upload",
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

async function router(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === "GET" && url.pathname === "/") return response(res, 200, renderHome());
  if (req.method === "GET" && url.pathname === "/uploads") return response(res, 200, renderUploads());
  if (req.method === "GET" && url.pathname === "/watch") return response(res, 200, renderWatchStatus());
  if (req.method === "GET" && url.pathname.startsWith("/uploads/")) return response(res, 200, renderUploadDetail(url.pathname.split("/")[2]));
  if (req.method === "GET" && url.pathname === "/summaries") return response(res, 200, renderSummaries());
  if (req.method === "GET" && url.pathname === "/summaries/export/top-mentions.csv") return handleAllTopMentionsExport(res);
  const exportMatch = url.pathname.match(/^\/summaries\/([^/]+)\/(export\.md|top-mentions\.csv)$/);
  if (req.method === "GET" && exportMatch) {
    return handleSummaryExport(res, exportMatch[1], exportMatch[2] === "export.md" ? "markdown" : "csv");
  }
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
