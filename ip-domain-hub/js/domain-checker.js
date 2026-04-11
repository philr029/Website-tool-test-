/* ════════════════════════════════════════════════════════════════════════════
   domain-checker.js — Domain Health module
   ─────────────────────────────────────────────────────────────────────────────
   Functions:
     runDomainCheck()       — validates input, runs mock check, renders results
     loadMockDomain()       — pre-fills input with a sample domain and runs check
     renderDomainResults()  — builds grouped result cards from a result object
     saveDomainResult()     — saves current result to AppData / dashboard
   ─────────────────────────────────────────────────────────────────────────────
   TODO for real API integration:
     Replace mock data with backend proxy calls to:
       - Cloudflare / Google DNS-over-HTTPS for real DNS lookups
       - SSL Labs API (api.ssllabs.com) for certificate grading
       - MXToolbox or similar for SPF/DKIM/DMARC validation
       - securityheaders.com API for header analysis
   ════════════════════════════════════════════════════════════════════════════ */

'use strict';

// Module-level reference to the last domain check result
let _currentDomainResult = null;

/** Basic domain format validation. */
function isValidDomain(str) {
  return /^[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z]{2,})+$/.test(str);
}

/**
 * Main entry point — called by the Check Domain button / Enter key.
 * Validates input, shows loading state, then renders mock results.
 */
function runDomainCheck() {
  const input = document.getElementById('domain-input');
  // Strip any protocol/trailing slashes the user might have typed
  let raw = (input.value || '').trim()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '');

  if (!raw) {
    showToast('Please enter a domain name', 'warning');
    input.focus();
    return;
  }
  if (!isValidDomain(raw)) {
    showToast('Please enter a valid domain name (e.g. example.com)', 'warning');
    input.focus();
    return;
  }

  // Show loading state on button
  const btn = document.getElementById('domain-check-btn');
  const origHtml = btn.innerHTML;
  btn.innerHTML = '<span class="loading-spinner"></span> Checking…';
  btn.disabled = true;

  // Simulate async API delay
  setTimeout(() => {
    const result = getMockDomainResult(raw);
    _currentDomainResult = result;

    renderDomainResults(result);

    btn.innerHTML = origHtml;
    btn.disabled = false;

    if (typeof refreshHeroStats === 'function') refreshHeroStats();
  }, 1100);
}

/** Pre-fill the input with a sample domain and run the check. */
function loadMockDomain() {
  const samples = ['google.com', 'example.com', 'cloudflare.com', 'expired-cert-demo.com'];
  const pick = samples[Math.floor(Math.random() * samples.length)];
  document.getElementById('domain-input').value = pick;
  runDomainCheck();
}

/**
 * Render domain result cards grouped into logical sections.
 * @param {Object} result  normalised result from getMockDomainResult()
 */
function renderDomainResults(result) {
  const d = result.data;

  // Header meta
  document.getElementById('domain-result-target').textContent = result.target;
  document.getElementById('domain-result-time').textContent   = `Checked at ${formatDate(result.timestamp)}`;

  const badge = document.getElementById('domain-health-badge');
  badge.className = `status-badge ${badgeClass(result.status)}`;
  badge.textContent = statusLabel(result.status);

  // Derive SSL status
  const sslStatus = !d.ssl.valid ? 'fail' : d.ssl.grade === 'A+' || d.ssl.grade === 'A' ? 'pass' : 'warning';

  // Helper: derive per-field dot class
  function dotFor(val) {
    const v = (val || '').toUpperCase();
    if (v.startsWith('PASS')) return 'dot-pass';
    if (v.startsWith('WARN') || v.startsWith('NOT FOUND') || v.startsWith('MISSING')) return 'dot-warn';
    if (v.startsWith('FAIL')) return 'dot-fail';
    return 'dot-info';
  }

  const grid = document.getElementById('domain-results-grid');
  grid.innerHTML = `

    ${domainCard('DNS Records', `
      ${checkRow('A Record',  d.aRecord,  'dot-info')}
      ${checkRow('MX Record', d.mxRecord, d.mxRecord === 'Not configured' ? 'dot-warn' : 'dot-pass')}
    `)}

    ${domainCard('Email Security', `
      ${checkRow('SPF',   d.spf,   dotFor(d.spf))}
      ${checkRow('DKIM',  d.dkim,  dotFor(d.dkim))}
      ${checkRow('DMARC', d.dmarc, dotFor(d.dmarc))}
    `)}

    ${domainCard('SSL Certificate', `
      ${checkRow('Grade',   d.ssl.grade,  sslStatus === 'pass' ? 'dot-pass' : sslStatus === 'fail' ? 'dot-fail' : 'dot-warn')}
      ${checkRow('Valid',   d.ssl.valid ? 'Yes ✓' : 'Expired / Invalid ✗', d.ssl.valid ? 'dot-pass' : 'dot-fail')}
      ${checkRow('Expiry',  d.ssl.expiry, 'dot-info')}
      ${checkRow('Issuer',  d.ssl.issuer, 'dot-info')}
    `)}

    ${domainCard('Redirects & Uptime', `
      ${checkRow('Redirect',  d.redirect, d.redirect.includes('→') ? 'dot-pass' : 'dot-warn')}
      ${checkRow('Uptime',    d.uptime,   d.uptime.includes('200') ? 'dot-pass' : 'dot-warn')}
    `)}

    ${domainCard('Security Headers', `
      ${checkRow('HSTS',               d.securityHeaders.hsts,  dotFor(d.securityHeaders.hsts))}
      ${checkRow('Content-Security',   d.securityHeaders.csp,   dotFor(d.securityHeaders.csp))}
      ${checkRow('X-Frame-Options',    d.securityHeaders.xfo,   dotFor(d.securityHeaders.xfo))}
      ${checkRow('X-Content-Type',     d.securityHeaders.xcto,  dotFor(d.securityHeaders.xcto))}
    `)}

  `;

  // Show results, hide empty state
  document.getElementById('domain-results').classList.remove('hidden');
  document.getElementById('domain-empty').classList.add('hidden');
}

/** Build a domain section card containing check rows. */
function domainCard(title, rowsHtml) {
  return `
    <div class="result-card">
      <div class="result-card-label">${escHtml(title)}</div>
      ${rowsHtml}
    </div>
  `;
}

/** Build a single check row (dot indicator + label + value). */
function checkRow(key, value, dotClass) {
  return `
    <div class="check-row">
      <span class="check-dot ${escHtml(dotClass)}"></span>
      <span class="check-key">${escHtml(key)}</span>
      <span class="check-val">${escHtml(value || '—')}</span>
    </div>
  `;
}

/**
 * Save the most recent domain check result to the shared dashboard store.
 */
function saveDomainResult() {
  if (!_currentDomainResult) return;
  AppData.addResult('domain', _currentDomainResult);
  showToast(`Domain result for ${_currentDomainResult.target} saved to Dashboard`, 'pass');

  // Prevent duplicate saves
  _currentDomainResult = null;
  document.querySelector('#domain-results .result-actions .btn').disabled = true;
}
