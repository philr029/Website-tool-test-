/**
 * FormFlow Tester — HTML Report Generator
 */

import fs from 'fs';
import path from 'path';
import { SuiteResult, FlowResult, StepResult } from './types';
import { ensureDir, formatDuration, slugify, writeJson } from './utils';

export function generateReport(suiteResult: SuiteResult, reportDir: string): string {
  ensureDir(reportDir);

  const timestamp = suiteResult.startedAt.replace(/[:.]/g, '-');
  const reportFile = path.join(reportDir, `report-${timestamp}.html`);
  const csvFile = path.join(reportDir, `results-${timestamp}.csv`);

  // Generate CSV
  const csvRows = suiteResult.flows.map((f) => ({
    flowId: f.flowId,
    flowName: f.flowName,
    url: f.url,
    status: f.status,
    tags: f.tags.join('|'),
    durationMs: f.durationMs,
    startedAt: f.startedAt,
    finishedAt: f.finishedAt,
    errorMessage: f.errorMessage ?? '',
    screenshotPath: f.screenshotPath ?? '',
  }));

  fs.writeFileSync(csvFile, buildCsv(csvRows), 'utf-8');

  // Generate HTML
  const html = buildHtml(suiteResult);
  fs.writeFileSync(reportFile, html, 'utf-8');

  // Update latest.json pointer used by the dashboard
  writeJson(path.join(reportDir, 'latest.json'), suiteResult);

  console.log(`📊 HTML report saved to: ${reportFile}`);
  console.log(`📋 CSV export saved to:  ${csvFile}`);

  return reportFile;
}

// ─── CSV ──────────────────────────────────────────────────────────────────────

function buildCsv(rows: Array<Record<string, string | number>>): string {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  return [
    headers.join(','),
    ...rows.map((row) =>
      headers.map((h) => JSON.stringify(String(row[h] ?? ''))).join(',')
    ),
  ].join('\n');
}

// ─── HTML ─────────────────────────────────────────────────────────────────────

function statusBadge(status: string): string {
  const map: Record<string, string> = {
    pass: 'badge-pass',
    fail: 'badge-fail',
    'manual-check-required': 'badge-manual',
    captcha: 'badge-manual',
    skipped: 'badge-skip',
    'partially-loaded': 'badge-partial',
  };
  const labels: Record<string, string> = {
    pass: '✅ PASS',
    fail: '❌ FAIL',
    'manual-check-required': '⚠️ Manual Check',
    captcha: '⚠️ CAPTCHA',
    skipped: '⏭ Skipped',
    'partially-loaded': '🔶 Partial',
  };
  const cls = map[status] ?? 'badge-skip';
  const label = labels[status] ?? status.toUpperCase();
  return `<span class="badge ${cls}">${label}</span>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function renderSteps(steps: StepResult[]): string {
  if (!steps.length) return '<p class="no-steps">No steps recorded.</p>';
  return `
    <table class="step-table">
      <thead>
        <tr><th>#</th><th>Step</th><th>Status</th><th>Duration</th><th>Message</th><th>Screenshot</th></tr>
      </thead>
      <tbody>
        ${steps
          .map(
            (s) => `
          <tr class="step-row ${s.status}">
            <td>${s.stepIndex + 1}</td>
            <td>${escapeHtml(s.stepName)}</td>
            <td>${statusBadge(s.status)}</td>
            <td>${formatDuration(s.durationMs)}</td>
            <td class="msg">${s.message ? escapeHtml(s.message) : '—'}</td>
            <td>${s.screenshotPath ? `<a href="${escapeHtml(s.screenshotPath)}" target="_blank">View</a>` : '—'}</td>
          </tr>`,
          )
          .join('')}
      </tbody>
    </table>`;
}

function renderFlow(flow: FlowResult, index: number): string {
  const detailId = `flow-${slugify(flow.flowId)}-${index}`;
  return `
  <div class="flow-card ${flow.status}">
    <div class="flow-header" onclick="toggleDetail('${detailId}')">
      <div class="flow-title">
        <span class="flow-name">${escapeHtml(flow.flowName)}</span>
        ${flow.tags.map((t) => `<span class="tag">${escapeHtml(t)}</span>`).join('')}
      </div>
      <div class="flow-meta">
        ${statusBadge(flow.status)}
        <span class="duration">${formatDuration(flow.durationMs)}</span>
        <span class="chevron">▾</span>
      </div>
    </div>
    <div id="${detailId}" class="flow-detail hidden">
      <div class="flow-info">
        <span>🌐 <a href="${escapeHtml(flow.url)}" target="_blank">${escapeHtml(flow.url)}</a></span>
        <span>🕐 Started: ${flow.startedAt}</span>
        <span>🕑 Finished: ${flow.finishedAt}</span>
      </div>
      ${flow.errorMessage ? `<div class="error-box">⛔ ${escapeHtml(flow.errorMessage)}</div>` : ''}
      ${flow.screenshotPath ? `<div class="screenshot-box"><img src="${escapeHtml(flow.screenshotPath)}" alt="screenshot" loading="lazy" /></div>` : ''}
      ${renderSteps(flow.steps)}
    </div>
  </div>`;
}

function buildHtml(suite: SuiteResult): string {
  const passRate =
    suite.totals.total > 0
      ? Math.round((suite.totals.pass / suite.totals.total) * 100)
      : 0;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>FormFlow Tester — ${escapeHtml(suite.suiteName)}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f1117; color: #e2e8f0; line-height: 1.6; }
    a { color: #60a5fa; text-decoration: none; } a:hover { text-decoration: underline; }

    /* Header */
    header { background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); border-bottom: 1px solid #334155; padding: 2rem; }
    header h1 { font-size: 1.8rem; font-weight: 700; color: #f1f5f9; }
    header h1 span { color: #60a5fa; }
    header .subtitle { color: #94a3b8; margin-top: 0.25rem; font-size: 0.9rem; }

    /* Summary cards */
    .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 1rem; padding: 1.5rem 2rem; }
    .card { background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 1.25rem 1.5rem; }
    .card .label { font-size: 0.75rem; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; }
    .card .value { font-size: 2rem; font-weight: 700; margin-top: 0.25rem; }
    .card.pass .value { color: #4ade80; }
    .card.fail .value { color: #f87171; }
    .card.manual .value { color: #fbbf24; }
    .card.partial .value { color: #fb923c; }
    .card.total .value { color: #60a5fa; }
    .card .sub { font-size: 0.8rem; color: #94a3b8; margin-top: 0.1rem; }

    /* Progress bar */
    .progress-bar { margin: 0 2rem 1rem; height: 8px; background: #1e293b; border-radius: 99px; overflow: hidden; }
    .progress-fill { height: 100%; border-radius: 99px; background: linear-gradient(90deg, #4ade80, #22d3ee); transition: width 0.6s ease; }

    /* Flow cards */
    .flows { padding: 0 2rem 2rem; }
    .flows h2 { color: #94a3b8; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 1rem; }
    .flow-card { background: #1e293b; border: 1px solid #334155; border-radius: 12px; margin-bottom: 0.75rem; overflow: hidden; }
    .flow-card.fail { border-color: #7f1d1d; }
    .flow-card.manual-check-required { border-color: #78350f; }
    .flow-card.partially-loaded { border-color: #9a3412; }
    .flow-header { display: flex; justify-content: space-between; align-items: center; padding: 1rem 1.25rem; cursor: pointer; transition: background 0.15s; }
    .flow-header:hover { background: rgba(255,255,255,0.03); }
    .flow-title { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
    .flow-name { font-weight: 600; }
    .flow-meta { display: flex; align-items: center; gap: 0.75rem; }
    .duration { font-size: 0.8rem; color: #64748b; }
    .chevron { color: #64748b; transition: transform 0.2s; }
    .flow-detail { padding: 0 1.25rem 1.25rem; border-top: 1px solid #334155; }
    .flow-detail.hidden { display: none; }
    .flow-info { display: flex; flex-wrap: wrap; gap: 1rem; padding: 0.75rem 0; font-size: 0.85rem; color: #94a3b8; }
    .error-box { background: #7f1d1d22; border: 1px solid #7f1d1d; border-radius: 8px; padding: 0.75rem 1rem; font-size: 0.85rem; color: #fca5a5; margin-bottom: 0.75rem; word-break: break-word; }
    .screenshot-box { margin-bottom: 0.75rem; } .screenshot-box img { max-width: 100%; border-radius: 8px; border: 1px solid #334155; }

    /* Steps table */
    .step-table { width: 100%; border-collapse: collapse; font-size: 0.82rem; }
    .step-table th { background: #0f1117; color: #64748b; font-weight: 600; text-align: left; padding: 0.5rem 0.75rem; border-bottom: 1px solid #334155; }
    .step-table td { padding: 0.5rem 0.75rem; border-bottom: 1px solid #1e293b; vertical-align: top; }
    .step-row.fail td { background: rgba(127,29,29,0.12); }
    .step-row.captcha td { background: rgba(120,53,15,0.12); }
    .msg { max-width: 320px; word-break: break-word; color: #94a3b8; }

    /* Tags */
    .tag { display: inline-block; background: #1d4ed822; color: #93c5fd; border: 1px solid #1d4ed8; border-radius: 99px; padding: 0.1rem 0.5rem; font-size: 0.72rem; }

    /* Badges */
    .badge { display: inline-block; border-radius: 99px; padding: 0.2rem 0.7rem; font-size: 0.78rem; font-weight: 600; white-space: nowrap; }
    .badge-pass { background: #14532d33; color: #4ade80; border: 1px solid #14532d; }
    .badge-fail { background: #7f1d1d33; color: #f87171; border: 1px solid #7f1d1d; }
    .badge-manual { background: #78350f33; color: #fbbf24; border: 1px solid #78350f; }
    .badge-partial { background: #9a341233; color: #fb923c; border: 1px solid #9a3412; }
    .badge-skip { background: #1e293b; color: #64748b; border: 1px solid #334155; }
    .no-steps { color: #64748b; font-size: 0.85rem; padding: 0.5rem 0; }

    /* Footer */
    footer { text-align: center; padding: 2rem; color: #475569; font-size: 0.8rem; border-top: 1px solid #1e293b; }

    @media (max-width: 600px) {
      header, .summary, .flows { padding-left: 1rem; padding-right: 1rem; }
      .flow-meta { gap: 0.4rem; } .flow-info { gap: 0.5rem; }
    }
  </style>
</head>
<body>
  <header>
    <h1>FormFlow <span>Tester</span></h1>
    <p class="subtitle">${escapeHtml(suite.suiteName)} — ${suite.startedAt} — ${suite.browser}</p>
  </header>

  <div class="summary">
    <div class="card total"><div class="label">Total Flows</div><div class="value">${suite.totals.total}</div></div>
    <div class="card pass"><div class="label">Passed</div><div class="value">${suite.totals.pass}</div><div class="sub">${passRate}% pass rate</div></div>
    <div class="card fail"><div class="label">Failed</div><div class="value">${suite.totals.fail}</div></div>
    <div class="card manual"><div class="label">Manual Check</div><div class="value">${suite.totals.manualCheckRequired}</div></div>
    <div class="card partial"><div class="label">Partial</div><div class="value">${suite.totals.partiallyLoaded}</div></div>
    <div class="card total"><div class="label">Duration</div><div class="value" style="font-size:1.4rem">${formatDuration(suite.durationMs)}</div></div>
  </div>

  <div class="progress-bar">
    <div class="progress-fill" style="width:${passRate}%"></div>
  </div>

  <div class="flows">
    <h2>Test Results</h2>
    ${suite.flows.map((f, i) => renderFlow(f, i)).join('\n')}
  </div>

  <footer>Generated by <strong>FormFlow Tester</strong> &mdash; ${new Date().toUTCString()}</footer>

  <script>
    function toggleDetail(id) {
      const el = document.getElementById(id);
      if (!el) return;
      el.classList.toggle('hidden');
      const chevron = el.previousElementSibling?.querySelector('.chevron');
      if (chevron) chevron.style.transform = el.classList.contains('hidden') ? '' : 'rotate(180deg)';
    }
  </script>
</body>
</html>`;
}
