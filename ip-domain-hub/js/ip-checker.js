/* ════════════════════════════════════════════════════════════════════════════
   ip-checker.js — IP Intelligence module
   ─────────────────────────────────────────────────────────────────────────────
   Functions:
     runIPCheck()       — validates input, runs mock check, renders results
     loadMockIP()       — pre-fills input with a sample IP and runs check
     renderIPResults()  — builds result cards from a result object
     saveIPResult()     — saves current result to AppData / dashboard
   ─────────────────────────────────────────────────────────────────────────────
   TODO for real API integration:
     Replace the mock generator in runIPCheck() with a fetch() call to a
     backend proxy that queries ip-api.com, AbuseIPDB, and a RBL lookup service.
     The proxy should normalise responses into the same shape as getMockIPResult().
   ════════════════════════════════════════════════════════════════════════════ */

'use strict';

// Module-level reference to the last IP check result (used by saveIPResult)
let _currentIPResult = null;

/** Validate a string as a plausible IPv4 or IPv6 address. */
function isValidIP(str) {
  const v4 = /^(\d{1,3}\.){3}\d{1,3}$/;
  const v6 = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/;
  return v4.test(str) || v6.test(str);
}

/**
 * Main entry point — called by the Run Check button / Enter key.
 * Validates input, shows a loading state, then renders mock results.
 */
function runIPCheck() {
  const input = document.getElementById('ip-input');
  const raw   = (input.value || '').trim();

  if (!raw) {
    showToast('Please enter an IP address', 'warning');
    input.focus();
    return;
  }
  if (!isValidIP(raw)) {
    showToast('Please enter a valid IPv4 or IPv6 address', 'warning');
    input.focus();
    return;
  }

  // Show loading state on button
  const btn = document.getElementById('ip-check-btn');
  const origHtml = btn.innerHTML;
  btn.innerHTML = '<span class="loading-spinner"></span> Checking…';
  btn.disabled = true;

  // Simulate async API delay (replace with real fetch when integrating)
  setTimeout(() => {
    const result = getMockIPResult(raw);
    _currentIPResult = result;

    renderIPResults(result);

    btn.innerHTML = origHtml;
    btn.disabled = false;

    // Update hero counters live
    if (typeof refreshHeroStats === 'function') refreshHeroStats();
  }, 900);
}

/** Pre-fill the input with a well-known IP and run the check. */
function loadMockIP() {
  const sampleIPs = ['8.8.8.8', '185.220.101.42', '104.16.123.96', '45.33.32.156'];
  const pick = sampleIPs[Math.floor(Math.random() * sampleIPs.length)];
  document.getElementById('ip-input').value = pick;
  runIPCheck();
}

/**
 * Render all IP result cards for the given result object.
 * @param {Object} result  normalised result from getMockIPResult()
 */
function renderIPResults(result) {
  const d = result.data;

  // Update header meta
  document.getElementById('ip-result-target').textContent = result.target;
  document.getElementById('ip-result-time').textContent   = `Checked at ${formatDate(result.timestamp)}`;

  const badge = document.getElementById('ip-health-badge');
  badge.className = `status-badge ${badgeClass(result.status)}`;
  badge.textContent = statusLabel(result.status);

  // Build result cards
  const grid = document.getElementById('ip-results-grid');
  grid.innerHTML = `
    ${ipCard('Geolocation', `
      <div class="result-card-value">${escHtml(d.city)}</div>
      <div class="result-card-sub">${escHtml(d.country)}</div>
    `)}
    ${ipCard('ISP / Provider', `
      <div class="result-card-value">${escHtml(d.isp)}</div>
      <div class="result-card-sub">${escHtml(d.asn)}</div>
    `)}
    ${ipCard('Reverse DNS', `
      <div class="result-card-value" style="font-family:var(--font-mono);font-size:0.85rem">
        ${escHtml(d.reverseDns || 'No PTR record')}
      </div>
    `)}
    ${ipCard('Blacklist / Reputation', `
      <div class="result-card-value" style="color:${d.blacklisted ? 'var(--fail)' : 'var(--pass)'}">
        ${d.blacklisted ? '⛔ Blacklisted' : '✅ Clean'}
      </div>
      <div class="result-card-sub">${escHtml(d.blacklistDetails)}</div>
    `)}
    ${ipCard('Abuse Confidence', `
      <div class="result-card-value" style="color:${d.abuse_confidence > 50 ? 'var(--fail)' : d.abuse_confidence > 15 ? 'var(--warn)' : 'var(--pass)'}">
        ${d.abuse_confidence}%
      </div>
      <div class="result-card-sub">AbuseIPDB confidence score</div>
    `)}
    ${ipCard('Open Ports (sample)', `
      <div class="result-card-value" style="font-family:var(--font-mono);font-size:0.85rem">
        ${d.openPorts && d.openPorts.length ? escHtml(d.openPorts.join(', ')) : 'None detected'}
      </div>
      <div class="result-card-sub">Common ports scanned</div>
    `)}
    ${ipCard('Last Seen (Threat DB)', `
      <div class="result-card-value">${escHtml(d.lastSeen || 'No history')}</div>
      <div class="result-card-sub">Most recent malicious activity</div>
    `)}
    ${ipCard('Overall Health Score', `
      <div class="health-score">
        <span class="health-score-value" style="color:${scoreColor(d.reputationScore)}">${d.reputationScore}</span>
        <div style="flex:1">
          <div class="health-bar-track">
            <div class="health-bar-fill"
              style="width:${d.reputationScore}%;background:${scoreColor(d.reputationScore)}">
            </div>
          </div>
          <div class="result-card-sub" style="margin-top:4px">out of 100</div>
        </div>
      </div>
    `)}
  `;

  // Show results, hide empty state
  document.getElementById('ip-results').classList.remove('hidden');
  document.getElementById('ip-empty').classList.add('hidden');
}

/** Build a single result card HTML string. */
function ipCard(label, bodyHtml) {
  return `
    <div class="result-card">
      <div class="result-card-label">${escHtml(label)}</div>
      ${bodyHtml}
    </div>
  `;
}

/**
 * Save the most recent IP check result to the shared dashboard store.
 * Called by the "Save to Dashboard" button.
 */
function saveIPResult() {
  if (!_currentIPResult) return;
  AppData.addResult('ip', _currentIPResult);
  showToast(`IP result for ${_currentIPResult.target} saved to Dashboard`, 'pass');

  // Prevent duplicate saves
  _currentIPResult = null;
  document.querySelector('#ip-results .result-actions .btn').disabled = true;
}
