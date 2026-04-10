/* ════════════════════════════════════════════════════════════════════════════
   dashboard.js — Unified Results Dashboard
   ─────────────────────────────────────────────────────────────────────────────
   Functions:
     onDataChanged()           — called by AppData whenever a result is added/removed
     renderDashboard()         — full re-render of stats, alerts, and table
     updateStats()             — update the 4 summary stat cards
     renderAlerts()            — render the alert panel (failures & warnings)
     renderResultsTable(rows)  — render the filtered results table
     applyDashboardFilters()   — read filter controls and re-render
     clearDashFilters()        — reset all filters
     exportCSV()               — download results as a CSV file
     loadAllMockData()         — seed AppData with all mock sample data
     refreshHeroStats()        — update the hero section counters
   ════════════════════════════════════════════════════════════════════════════ */

'use strict';

/**
 * Called whenever AppData changes (registered in data.js as a hook).
 * Re-renders the full dashboard with current data.
 */
function onDataChanged() {
  renderDashboard();
  refreshHeroStats();
}

/** Full dashboard re-render. */
function renderDashboard() {
  updateStats();
  renderAlerts();
  applyDashboardFilters();
}

/** Update the 4 summary stat cards with current counts. */
function updateStats() {
  const c = AppData.getCounts();
  document.getElementById('dash-total').textContent = c.total;
  document.getElementById('dash-pass').textContent  = c.pass;
  document.getElementById('dash-warn').textContent  = c.warning;
  document.getElementById('dash-fail').textContent  = c.fail;
}

/**
 * Render the alert panel — shows all failures and warnings in reverse
 * chronological order, capped at 10 items for readability.
 */
function renderAlerts() {
  const alertList = document.getElementById('alert-list');
  const alertCount = document.getElementById('alert-count');

  const alerts = AppData.getAllResults()
    .filter(r => r.status === 'fail' || r.status === 'warning')
    .slice(0, 10);

  alertCount.textContent = alerts.length;

  if (alerts.length === 0) {
    alertList.innerHTML = '<p class="no-alerts">No recent failures or warnings</p>';
    return;
  }

  alertList.innerHTML = alerts.map(r => {
    const badgeCls = r.status === 'fail' ? 'badge-fail' : 'badge-warning';
    const icon = r.status === 'fail'
      ? `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`
      : `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/></svg>`;

    return `
      <div class="alert-item">
        <span class="status-badge ${escHtml(badgeCls)}" style="padding:2px 7px;gap:3px">
          ${icon} ${escHtml(statusLabel(r.status))}
        </span>
        <span class="alert-item-type">${escHtml(r.type)}</span>
        <span class="alert-item-target">${escHtml(r.target)}</span>
        <span class="alert-item-time">${escHtml(formatDate(r.timestamp))}</span>
      </div>
    `;
  }).join('');
}

/**
 * Read filter control values and re-render the results table.
 * Called on every filter change and after data updates.
 */
function applyDashboardFilters() {
  const type   = document.getElementById('filter-type')?.value   || 'all';
  const status = document.getElementById('filter-status')?.value || 'all';
  const date   = document.getElementById('filter-date')?.value   || '';

  const rows = AppData.filterResults({ type, status, date });
  renderResultsTable(rows);
}

/** Clear all filter controls and re-render. */
function clearDashFilters() {
  const typeEl   = document.getElementById('filter-type');
  const statusEl = document.getElementById('filter-status');
  const dateEl   = document.getElementById('filter-date');
  if (typeEl)   typeEl.value   = 'all';
  if (statusEl) statusEl.value = 'all';
  if (dateEl)   dateEl.value   = '';
  applyDashboardFilters();
}

/**
 * Render the results table rows.
 * @param {Array} rows  filtered array of result objects
 */
function renderResultsTable(rows) {
  const tbody  = document.getElementById('results-tbody');
  const table  = document.getElementById('results-table');
  const empty  = document.getElementById('dash-empty');

  if (!rows || rows.length === 0) {
    tbody.innerHTML  = '';
    table.style.display = 'none';
    empty.classList.remove('hidden');
    return;
  }

  table.style.display = '';
  empty.classList.add('hidden');

  tbody.innerHTML = rows.map(r => {
    const typeCls  = `type-${escHtml(r.type)}`;
    const typeIcon = typeIconSVG(r.type);
    const badgeCls = badgeClass(r.status);

    return `
      <tr>
        <td>
          <span class="type-badge ${typeCls}">
            ${typeIcon} ${escHtml(r.type.toUpperCase())}
          </span>
        </td>
        <td><span class="table-target">${escHtml(r.target)}</span></td>
        <td><span class="status-badge ${escHtml(badgeCls)}">${escHtml(statusLabel(r.status))}</span></td>
        <td><span class="table-summary">${escHtml(r.summary)}</span></td>
        <td><span class="table-date">${escHtml(formatDate(r.timestamp))}</span></td>
        <td class="table-actions">
          <button class="btn-icon" title="Remove" onclick="removeResult('${escHtml(r.id)}')">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
            </svg>
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

/** Remove a result from AppData and re-render. */
function removeResult(id) {
  AppData.removeResult(id);

  // Also re-render the phone log if a phone entry was removed
  if (typeof renderPhoneLog === 'function') renderPhoneLog();
}

/** Return a small inline SVG icon for each result type. */
function typeIconSVG(type) {
  if (type === 'ip') {
    return `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg>`;
  }
  if (type === 'domain') {
    return `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`;
  }
  return `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.4 2 2 0 0 1 3.6 1.22h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.77a16 16 0 0 0 6.29 6.29l.96-.96a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/></svg>`;
}

/**
 * Trigger a CSV download of the currently filtered results.
 * If no filter is active, all results are exported.
 */
function exportCSV() {
  const type   = document.getElementById('filter-type')?.value   || 'all';
  const status = document.getElementById('filter-status')?.value || 'all';
  const date   = document.getElementById('filter-date')?.value   || '';

  const rows = AppData.filterResults({ type, status, date });

  if (rows.length === 0) {
    showToast('No results to export', 'warning');
    return;
  }

  const csv  = AppData.toCSV(rows);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href     = url;
  link.download = `ipdh-export-${new Date().toISOString().slice(0,10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);

  showToast(`Exported ${rows.length} result${rows.length !== 1 ? 's' : ''} as CSV`, 'pass');
}

/**
 * Seed AppData with all available mock data from data.js.
 * Adds IP, domain, and phone test samples to demonstrate the full dashboard.
 */
function loadAllMockData() {
  // Add all mock IP results
  MOCK_IP_DATA.forEach(d => {
    AppData.addResult('ip', {
      id:        genId(),
      type:      'ip',
      target:    d.ip,
      status:    d.status,
      summary:   `${d.isp} · ${d.country} · Score ${d.reputationScore}/100`,
      timestamp: new Date(Date.now() - Math.random() * 86400000 * 7).toISOString(),
      data:      { ...d },
    });
  });

  // Add all mock domain results
  MOCK_DOMAIN_DATA.forEach(d => {
    AppData.addResult('domain', {
      id:        genId(),
      type:      'domain',
      target:    d.domain,
      status:    d.status,
      summary:   `SSL ${d.ssl.grade} · SPF ${d.spf.split(' ')[0]} · DMARC ${d.dmarc.split(' ')[0]}`,
      timestamp: new Date(Date.now() - Math.random() * 86400000 * 7).toISOString(),
      data:      { ...d },
    });
  });

  // Add all mock phone test entries
  MOCK_PHONE_ENTRIES.forEach(m => {
    const entry = buildPhoneEntry({
      name:      m.name,
      phone:     m.phone,
      extension: m.extension || '',
      expected:  m.expected,
      actual:    m.actual,
      status:    m.status,
      datetime:  m.datetime,
      notes:     m.notes,
    });
    AppData.addResult('phone', entry);
  });

  // Re-render phone log if visible
  if (typeof renderPhoneLog === 'function') renderPhoneLog();

  showToast('Sample data loaded — dashboard populated', 'pass');
}

/** Update the hero section's live counters. */
function refreshHeroStats() {
  const c = AppData.getCounts();
  const el = id => document.getElementById(id);
  if (el('hero-total')) el('hero-total').textContent = c.total;
  if (el('hero-pass'))  el('hero-pass').textContent  = c.pass;
  if (el('hero-warn'))  el('hero-warn').textContent  = c.warning;
  if (el('hero-fail'))  el('hero-fail').textContent  = c.fail;
}
