/* FormFlow Tester — Dashboard App */

(function () {
  'use strict';

  // ─── Utilities ─────────────────────────────────────────────────────────────

  function formatDuration(ms) {
    if (typeof ms !== 'number') return '—';
    if (ms < 1000) return ms + 'ms';
    if (ms < 60000) return (ms / 1000).toFixed(1) + 's';
    const m = Math.floor(ms / 60000);
    const s = ((ms % 60000) / 1000).toFixed(0);
    return m + 'm ' + s + 's';
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function statusBadge(status) {
    const map = {
      pass: ['badge-pass', '✅ PASS'],
      fail: ['badge-fail', '❌ FAIL'],
      'manual-check-required': ['badge-manual', '⚠️ Manual Check'],
      captcha: ['badge-manual', '⚠️ CAPTCHA'],
      skipped: ['badge-skip', '⏭ Skipped'],
    };
    const [cls, label] = map[status] || ['badge-skip', status.toUpperCase()];
    return `<span class="badge ${cls}">${label}</span>`;
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  function renderOverview(suite) {
    const total = suite.totals?.total ?? 0;
    const pass = suite.totals?.pass ?? 0;
    const fail = suite.totals?.fail ?? 0;
    const manual = suite.totals?.manualCheckRequired ?? 0;
    const passRate = total > 0 ? Math.round((pass / total) * 100) : 0;

    document.getElementById('run-timestamp').textContent = suite.startedAt ?? '—';
    document.getElementById('val-total').textContent = total;
    document.getElementById('val-pass').textContent = pass;
    document.getElementById('val-fail').textContent = fail;
    document.getElementById('val-manual').textContent = manual;
    document.getElementById('val-duration').textContent = formatDuration(suite.durationMs);
    document.getElementById('val-browser').textContent = suite.browser ?? '—';
    document.getElementById('pass-rate-label').textContent = passRate + '%';
    document.getElementById('progress-bar').style.width = passRate + '%';
  }

  function renderSteps(steps) {
    if (!steps || steps.length === 0) {
      return '<p style="color:var(--faint);font-size:.85rem">No steps recorded.</p>';
    }
    const rows = steps.map(s => `
      <tr class="step-row ${escapeHtml(s.status)}">
        <td>${s.stepIndex + 1}</td>
        <td>${escapeHtml(s.stepName)}</td>
        <td>${statusBadge(s.status)}</td>
        <td>${formatDuration(s.durationMs)}</td>
        <td class="step-msg">${s.message ? escapeHtml(s.message) : '—'}</td>
        <td>${s.screenshotPath
          ? `<a href="${escapeHtml(s.screenshotPath)}" target="_blank">View</a>`
          : '—'}</td>
      </tr>`).join('');
    return `
      <table class="step-table">
        <thead>
          <tr><th>#</th><th>Step</th><th>Status</th><th>Duration</th><th>Message</th><th>Screenshot</th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>`;
  }

  function renderFlowCard(flow, index) {
    const detailId = 'detail-' + index;
    const tags = (flow.tags || []).map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('');
    return `
      <div class="flow-card ${escapeHtml(flow.status)}" data-status="${escapeHtml(flow.status)}">
        <div class="flow-header" onclick="toggleFlow('${detailId}', this)">
          <div class="flow-title">
            <span class="flow-name">${escapeHtml(flow.flowName)}</span>
            ${tags}
          </div>
          <div class="flow-meta">
            ${statusBadge(flow.status)}
            <span class="duration">${formatDuration(flow.durationMs)}</span>
            <span class="chevron">▾</span>
          </div>
        </div>
        <div id="${detailId}" class="flow-detail">
          <div class="flow-info">
            <span>🌐 <a href="${escapeHtml(flow.url)}" target="_blank">${escapeHtml(flow.url)}</a></span>
            <span>🕐 Started: ${escapeHtml(flow.startedAt)}</span>
            <span>🕑 Finished: ${escapeHtml(flow.finishedAt)}</span>
          </div>
          ${flow.errorMessage ? `<div class="error-box">⛔ ${escapeHtml(flow.errorMessage)}</div>` : ''}
          ${flow.screenshotPath ? `<div class="screenshot-box"><img src="${escapeHtml(flow.screenshotPath)}" alt="screenshot" loading="lazy" /></div>` : ''}
          ${renderSteps(flow.steps)}
        </div>
      </div>`;
  }

  function renderFlowList(flows) {
    const container = document.getElementById('flow-list');
    if (!flows || flows.length === 0) {
      container.innerHTML = '<p style="color:var(--faint);padding:2rem">No flows found in this report.</p>';
      return;
    }
    container.innerHTML = flows.map((f, i) => renderFlowCard(f, i)).join('');
  }

  // ─── Filter ──────────────────────────────────────────────────────────────────

  let currentFilter = 'all';
  let allFlows = [];

  function applyFilter(filter) {
    currentFilter = filter;
    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.filter === filter);
    });
    const filtered = filter === 'all'
      ? allFlows
      : allFlows.filter(f => f.status === filter);
    renderFlowList(filtered);
  }

  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => applyFilter(btn.dataset.filter));
  });

  // ─── Toggle Flow Detail ───────────────────────────────────────────────────────

  window.toggleFlow = function (id, header) {
    const detail = document.getElementById(id);
    if (!detail) return;
    detail.classList.toggle('open');
    const chevron = header.querySelector('.chevron');
    if (chevron) chevron.classList.toggle('open');
  };

  // ─── Load Data ────────────────────────────────────────────────────────────────

  function loadSuiteResult(data) {
    try {
      renderOverview(data);
      allFlows = data.flows || [];
      applyFilter(currentFilter);
    } catch (e) {
      console.error('Error rendering results:', e);
      alert('Error rendering results: ' + e.message);
    }
  }

  // Try to fetch latest.json automatically (works when served via HTTP)
  fetch('../reports/latest.json')
    .then(r => { if (!r.ok) throw new Error('not found'); return r.json(); })
    .then(loadSuiteResult)
    .catch(() => {
      // Silently fail — user can load manually
    });

  // File upload fallback
  const fileInput = document.getElementById('file-input');
  if (fileInput) {
    fileInput.addEventListener('change', function () {
      const file = this.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = function (e) {
        try {
          const data = JSON.parse(e.target.result);
          loadSuiteResult(data);
        } catch (err) {
          alert('Invalid JSON file: ' + err.message);
        }
      };
      reader.readAsText(file);
    });
  }
})();
