/* ════════════════════════════════════════════════════════════════════════════
   phone-tester.js — Phone & Call Flow Testing module
   ─────────────────────────────────────────────────────────────────────────────
   Functions:
     submitPhoneTest(event)  — handles form submit, validates, saves entry
     resetPhoneForm()        — clears the form back to defaults
     loadMockPhone()         — loads a random pre-built mock entry
     renderPhoneLog()        — re-renders the full phone test log
     deletePhoneTest(id)     — removes an entry from the log
   ─────────────────────────────────────────────────────────────────────────────
   TODO for real integration:
     - Wire up to a Twilio API proxy to automate outbound test calls
     - Auto-populate actual outcome via call recording / IVR response parsing
     - Add webhook trigger on test failure to notify operations team
   ════════════════════════════════════════════════════════════════════════════ */

'use strict';

/**
 * Handle the phone test form submission.
 * Validates required fields, builds an entry, adds to AppData, and re-renders.
 * @param {Event} event  form submit event
 */
function submitPhoneTest(event) {
  event.preventDefault();

  const name     = document.getElementById('pt-name').value.trim();
  const phone    = document.getElementById('pt-phone').value.trim();
  const ext      = document.getElementById('pt-ext').value.trim();
  const expected = document.getElementById('pt-expected').value.trim();
  const actual   = document.getElementById('pt-actual').value.trim();
  const status   = document.getElementById('pt-status').value;
  const datetime = document.getElementById('pt-datetime').value;
  const notes    = document.getElementById('pt-notes').value.trim();

  // Validate required fields
  if (!name)   { showToast('Test Name is required', 'warning'); document.getElementById('pt-name').focus();   return; }
  if (!phone)  { showToast('Phone Number is required', 'warning'); document.getElementById('pt-phone').focus(); return; }
  if (!expected) { showToast('Expected Outcome is required', 'warning'); document.getElementById('pt-expected').focus(); return; }
  if (!status) { showToast('Please select a status', 'warning'); document.getElementById('pt-status').focus(); return; }

  const entry = buildPhoneEntry({ name, phone, extension: ext, expected, actual, status, datetime, notes });
  AppData.addResult('phone', entry);

  showToast(`Phone test "${name}" logged`, status);
  resetPhoneForm();
  renderPhoneLog();

  if (typeof refreshHeroStats === 'function') refreshHeroStats();
}

/** Reset all phone form fields to their empty/default state. */
function resetPhoneForm() {
  document.getElementById('phone-form').reset();
  // Set datetime to current local time as a convenience default
  const now = new Date();
  const local = now.toISOString().slice(0, 16); // "YYYY-MM-DDTHH:MM"
  document.getElementById('pt-datetime').value = local;
}

/**
 * Load a random mock phone test entry into the form and log it immediately.
 * Useful for populating sample data quickly.
 */
function loadMockPhone() {
  // Pick a random entry from the mock set that hasn't been added yet,
  // or just pick randomly if all have been used
  const mock = MOCK_PHONE_ENTRIES[Math.floor(Math.random() * MOCK_PHONE_ENTRIES.length)];

  const entry = buildPhoneEntry({
    name:      mock.name,
    phone:     mock.phone,
    extension: mock.extension || '',
    expected:  mock.expected,
    actual:    mock.actual,
    status:    mock.status,
    datetime:  mock.datetime || new Date().toISOString().slice(0,16),
    notes:     mock.notes,
  });

  AppData.addResult('phone', entry);
  showToast(`Sample test "${mock.name}" added`, mock.status);
  renderPhoneLog();

  if (typeof refreshHeroStats === 'function') refreshHeroStats();
}

/**
 * Re-render the complete phone test log from AppData.phoneTests.
 * Called after any add/delete operation.
 */
function renderPhoneLog() {
  const log     = document.getElementById('phone-log');
  const empty   = document.getElementById('phone-empty');
  const counter = document.getElementById('phone-count');
  const tests   = AppData.phoneTests;

  counter.textContent = `${tests.length} ${tests.length === 1 ? 'entry' : 'entries'}`;

  if (tests.length === 0) {
    log.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }

  empty.classList.add('hidden');

  log.innerHTML = tests.map(entry => phoneEntryCard(entry)).join('');
}

/**
 * Build the HTML for a single phone test entry card.
 * @param {Object} entry  phone test result object
 * @returns {string}
 */
function phoneEntryCard(entry) {
  const d = entry.data;
  const badgeCls  = badgeClass(entry.status);
  const statusTxt = statusLabel(entry.status);
  const dateStr   = formatDate(entry.timestamp);

  return `
    <div class="phone-entry" id="pe-${escHtml(entry.id)}">
      <div class="phone-entry-header">
        <div>
          <div class="phone-entry-name">${escHtml(d.name)}</div>
          <div class="phone-entry-number">${escHtml(d.phone)}${d.extension ? ' · Ext/Queue: ' + escHtml(d.extension) : ''}</div>
        </div>
        <span class="status-badge ${escHtml(badgeCls)}">${escHtml(statusTxt)}</span>
      </div>

      <div class="phone-entry-meta">
        <div>
          <span class="phone-entry-label">Expected</span>
          <div>${escHtml(d.expected)}</div>
        </div>
        <div>
          <span class="phone-entry-label">Actual</span>
          <div>${escHtml(d.actual || '—')}</div>
        </div>
      </div>

      ${d.notes ? `<div class="phone-entry-notes">${escHtml(d.notes)}</div>` : ''}

      <div class="phone-entry-actions">
        <small style="color:var(--text-muted);font-size:0.72rem;margin-right:auto">${escHtml(dateStr)}</small>
        <button class="btn-icon" title="Delete entry" onclick="deletePhoneTest('${escHtml(entry.id)}')">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
            <path d="M10 11v6M14 11v6"/>
          </svg>
        </button>
      </div>
    </div>
  `;
}

/**
 * Delete a phone test entry from the store and re-render.
 * @param {string} id  entry ID
 */
function deletePhoneTest(id) {
  AppData.removeResult(id);
  renderPhoneLog();
  if (typeof refreshHeroStats === 'function') refreshHeroStats();
}

/** Initialise the datetime field to the current local time on page load. */
function initPhoneDatetime() {
  const now = new Date();
  const local = now.toISOString().slice(0, 16);
  const dtField = document.getElementById('pt-datetime');
  if (dtField) dtField.value = local;
}
