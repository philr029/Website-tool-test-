/* ════════════════════════════════════════════════════════════════════════════
   data.js — Shared data store + mock data
   ─────────────────────────────────────────────────────────────────────────────
   This is the single source of truth for all test results across all three
   modules (IP, Domain, Phone). When integrating real APIs, replace the mock
   generators with actual API calls and store the normalised response here.

   Structure:
     AppData.ipTests      — array of IP check results
     AppData.domainTests  — array of domain check results
     AppData.phoneTests   — array of phone test log entries

   Each result object follows a shared schema:
     { id, type, target, status, summary, timestamp, data }

   status is always one of: 'pass' | 'warning' | 'fail'
   ════════════════════════════════════════════════════════════════════════════ */

'use strict';

// ─── AppData: Central Store ──────────────────────────────────────────────────

const AppData = {
  ipTests:     [],
  domainTests: [],
  phoneTests:  [],

  /** Add a result to the appropriate sub-store and refresh the dashboard. */
  addResult(type, result) {
    if (type === 'ip')     this.ipTests.unshift(result);
    if (type === 'domain') this.domainTests.unshift(result);
    if (type === 'phone')  this.phoneTests.unshift(result);
    // Notify dashboard to re-render (dashboard.js registers this handler)
    if (typeof onDataChanged === 'function') onDataChanged();
  },

  /** Remove a result by id from any store. */
  removeResult(id) {
    this.ipTests     = this.ipTests.filter(r => r.id !== id);
    this.domainTests = this.domainTests.filter(r => r.id !== id);
    this.phoneTests  = this.phoneTests.filter(r => r.id !== id);
    if (typeof onDataChanged === 'function') onDataChanged();
  },

  /**
   * Get all results combined, sorted newest-first.
   * @returns {Array} flat array of all test result objects
   */
  getAllResults() {
    return [
      ...this.ipTests,
      ...this.domainTests,
      ...this.phoneTests,
    ].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  },

  /**
   * Filter results by type, status, and/or date.
   * @param {Object} opts  { type: string, status: string, date: string (YYYY-MM-DD) }
   * @returns {Array}
   */
  filterResults({ type = 'all', status = 'all', date = '' } = {}) {
    return this.getAllResults().filter(r => {
      if (type   !== 'all' && r.type   !== type)   return false;
      if (status !== 'all' && r.status !== status) return false;
      if (date) {
        const d = new Date(r.timestamp);
        const dayStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
        if (dayStr !== date) return false;
      }
      return true;
    });
  },

  /** Get counts for summary stats. */
  getCounts() {
    const all = this.getAllResults();
    return {
      total:   all.length,
      pass:    all.filter(r => r.status === 'pass').length,
      warning: all.filter(r => r.status === 'warning').length,
      fail:    all.filter(r => r.status === 'fail').length,
    };
  },

  /**
   * Export all results (or a filtered subset) as a CSV string.
   * @param {Array|null} rows  optional pre-filtered rows; defaults to all
   * @returns {string} CSV content
   */
  toCSV(rows = null) {
    const data = rows || this.getAllResults();
    const headers = ['ID', 'Type', 'Target', 'Status', 'Summary', 'Timestamp'];
    const escape = v => `"${String(v || '').replace(/"/g, '""')}"`;
    const lines = [
      headers.join(','),
      ...data.map(r => [
        escape(r.id),
        escape(r.type),
        escape(r.target),
        escape(r.status),
        escape(r.summary),
        escape(r.timestamp),
      ].join(',')),
    ];
    return lines.join('\r\n');
  },
};


// ─── Utility helpers ─────────────────────────────────────────────────────────

/** Generate a short random ID. */
function genId() {
  return Math.random().toString(36).slice(2, 10);
}

/** Format a Date (or ISO string) to a human-readable string. */
function formatDate(dt) {
  const d = dt ? new Date(dt) : new Date();
  return d.toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

/** Return 'pass', 'warning', or 'fail' CSS badge class. */
function badgeClass(status) {
  if (status === 'pass')    return 'badge-pass';
  if (status === 'warning') return 'badge-warning';
  return 'badge-fail';
}

/** Return a label string for a status value. */
function statusLabel(status) {
  if (status === 'pass')    return 'Pass';
  if (status === 'warning') return 'Warning';
  return 'Fail';
}

/** Escape HTML special characters to prevent XSS. */
function escHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Clamp a number between min and max. */
function clamp(n, min, max) { return Math.min(max, Math.max(min, n)); }

/** Return a health colour (CSS variable name) based on score 0-100. */
function scoreColor(score) {
  if (score >= 80) return 'var(--pass)';
  if (score >= 50) return 'var(--warn)';
  return 'var(--fail)';
}


// ─── Mock Data: IP Tests ─────────────────────────────────────────────────────
// Realistic-looking sample data for the IP Intelligence module.

const MOCK_IP_DATA = [
  {
    ip: '8.8.8.8',
    label: 'Google Public DNS',
    country: 'United States',
    city: 'Mountain View, CA',
    isp: 'Google LLC',
    asn: 'AS15169',
    reverseDns: 'dns.google',
    blacklisted: false,
    blacklistDetails: 'Not listed on any monitored RBL',
    reputationScore: 98,
    openPorts: [53, 80, 443],
    abuse_confidence: 0,
    lastSeen: '—',
    status: 'pass',
  },
  {
    ip: '185.220.101.42',
    label: 'Tor Exit Node',
    country: 'Germany',
    city: 'Frankfurt',
    isp: 'Digitale Gesellschaft e.V.',
    asn: 'AS208294',
    reverseDns: 'tor-exit.example.de',
    blacklisted: true,
    blacklistDetails: 'Listed on Spamhaus XBL, DNSBL',
    reputationScore: 18,
    openPorts: [9001, 9030],
    abuse_confidence: 86,
    lastSeen: '2 hours ago',
    status: 'fail',
  },
  {
    ip: '104.16.123.96',
    label: 'Cloudflare CDN',
    country: 'United States',
    city: 'San Jose, CA',
    isp: 'Cloudflare, Inc.',
    asn: 'AS13335',
    reverseDns: 'N/A',
    blacklisted: false,
    blacklistDetails: 'Not listed on any monitored RBL',
    reputationScore: 91,
    openPorts: [80, 443],
    abuse_confidence: 2,
    lastSeen: '—',
    status: 'pass',
  },
  {
    ip: '45.33.32.156',
    label: 'Linode / Akamai',
    country: 'United States',
    city: 'Fremont, CA',
    isp: 'Akamai Technologies',
    asn: 'AS63949',
    reverseDns: 'li674-156.members.linode.com',
    blacklisted: false,
    blacklistDetails: 'Not listed on any monitored RBL',
    reputationScore: 74,
    openPorts: [22, 80, 443],
    abuse_confidence: 12,
    lastSeen: '3 days ago',
    status: 'warning',
  },
];

/** Return a pre-built mock IP result object ready to save to AppData. */
function getMockIPResult(ipStr) {
  // Look for a known mock entry or return a generic one
  const known = MOCK_IP_DATA.find(d => d.ip === (ipStr || '').trim());
  const d = known || {
    ip: ipStr || '192.0.2.1',
    label: 'Example IP',
    country: 'United States',
    city: 'Anytown, USA',
    isp: 'Example ISP',
    asn: 'AS64496',
    reverseDns: 'host.example.com',
    blacklisted: false,
    blacklistDetails: 'Not listed on any monitored RBL',
    reputationScore: 72,
    openPorts: [80, 443],
    abuse_confidence: 5,
    lastSeen: '—',
    status: 'pass',
  };

  return {
    id: genId(),
    type: 'ip',
    target: d.ip,
    status: d.status,
    summary: `${d.isp} · ${d.country} · Score ${d.reputationScore}/100`,
    timestamp: new Date().toISOString(),
    data: { ...d },
  };
}


// ─── Mock Data: Domain Tests ──────────────────────────────────────────────────

const MOCK_DOMAIN_DATA = [
  {
    domain: 'google.com',
    aRecord: '142.250.185.78',
    mxRecord: 'aspmx.l.google.com (priority 1)',
    spf: 'PASS — v=spf1 include:_spf.google.com ~all',
    dkim: 'PASS — google._domainkey verified',
    dmarc: 'PASS — p=reject; rua=mailto:mailauth-reports@google.com',
    ssl: { grade: 'A+', expiry: '2025-09-14', issuer: 'GTS CA 1C3', valid: true },
    redirect: 'HTTP → HTTPS (301) ✓',
    uptime: '99.99% (200 OK, 42ms)',
    securityHeaders: {
      hsts: 'PASS',
      csp: 'PASS',
      xfo: 'PASS',
      xcto: 'PASS',
    },
    status: 'pass',
  },
  {
    domain: 'example.com',
    aRecord: '93.184.216.34',
    mxRecord: 'Not configured',
    spf: 'WARN — v=spf1 -all (no senders allowed)',
    dkim: 'NOT FOUND — no DKIM selector published',
    dmarc: 'WARN — p=none; no enforcement',
    ssl: { grade: 'B', expiry: '2025-06-01', issuer: 'DigiCert Inc', valid: true },
    redirect: 'HTTP → HTTPS (301) ✓',
    uptime: '200 OK, 188ms',
    securityHeaders: {
      hsts: 'PASS',
      csp: 'MISSING',
      xfo: 'PASS',
      xcto: 'MISSING',
    },
    status: 'warning',
  },
  {
    domain: 'expired-cert-demo.com',
    aRecord: '52.72.196.1',
    mxRecord: 'mail.expired-cert-demo.com (priority 10)',
    spf: 'PASS — v=spf1 ip4:52.72.196.1 ~all',
    dkim: 'NOT FOUND',
    dmarc: 'FAIL — No DMARC record found',
    ssl: { grade: 'F', expiry: '2023-12-01', issuer: 'Let\'s Encrypt', valid: false },
    redirect: 'HTTP only — no HTTPS redirect',
    uptime: '200 OK, 890ms',
    securityHeaders: {
      hsts: 'MISSING',
      csp: 'MISSING',
      xfo: 'MISSING',
      xcto: 'MISSING',
    },
    status: 'fail',
  },
  {
    domain: 'cloudflare.com',
    aRecord: '104.16.133.229',
    mxRecord: 'isaac.mx.cloudflare.net (priority 2)',
    spf: 'PASS — v=spf1 include:_spf.cloudflare.com ~all',
    dkim: 'PASS — cloudflare._domainkey verified',
    dmarc: 'PASS — p=reject; adkim=r; aspf=r',
    ssl: { grade: 'A+', expiry: '2025-11-05', issuer: 'Cloudflare Inc ECC CA-3', valid: true },
    redirect: 'HTTP → HTTPS (301) ✓',
    uptime: '99.99% (200 OK, 11ms)',
    securityHeaders: {
      hsts: 'PASS',
      csp: 'PASS',
      xfo: 'PASS',
      xcto: 'PASS',
    },
    status: 'pass',
  },
];

/** Return a pre-built mock domain result object. */
function getMockDomainResult(domainStr) {
  const known = MOCK_DOMAIN_DATA.find(d => d.domain === (domainStr || '').trim().toLowerCase());
  const d = known || {
    domain: domainStr || 'example.org',
    aRecord: '203.0.113.5',
    mxRecord: 'mail.example.org (priority 10)',
    spf: 'WARN — SPF record present but soft fail (~all)',
    dkim: 'NOT FOUND',
    dmarc: 'WARN — p=none',
    ssl: { grade: 'A', expiry: '2025-08-20', issuer: 'Let\'s Encrypt', valid: true },
    redirect: 'HTTP → HTTPS (301) ✓',
    uptime: '200 OK, 240ms',
    securityHeaders: { hsts: 'PASS', csp: 'MISSING', xfo: 'PASS', xcto: 'MISSING' },
    status: 'warning',
  };

  return {
    id: genId(),
    type: 'domain',
    target: d.domain,
    status: d.status,
    summary: `SSL ${d.ssl.grade} · SPF ${d.spf.split(' ')[0]} · DMARC ${d.dmarc.split(' ')[0]}`,
    timestamp: new Date().toISOString(),
    data: { ...d },
  };
}


// ─── Mock Data: Phone Tests ───────────────────────────────────────────────────

const MOCK_PHONE_ENTRIES = [
  {
    name: 'Sales Queue — Business Hours',
    phone: '+44 20 7946 0101',
    extension: 'Sales Queue',
    expected: 'Answered within 20s by sales agent, greeted with "Sales, how can I help?"',
    actual: 'Answered in 14s, correct greeting received',
    status: 'pass',
    notes: 'Test run during peak hours 11:00 AM. Consistent with SLA.',
    datetime: '2024-11-10T11:00:00',
  },
  {
    name: 'After-Hours IVR Flow',
    phone: '+44 20 7946 0101',
    extension: '1',
    expected: 'IVR plays after-hours message, offers voicemail option',
    actual: 'IVR message played correctly, voicemail option offered at prompt 2',
    status: 'pass',
    notes: 'Tested at 19:30. Voicemail box confirmed active.',
    datetime: '2024-11-09T19:30:00',
  },
  {
    name: 'Support Queue — Overflow Test',
    phone: '+44 20 7946 0201',
    extension: 'Support Queue',
    expected: 'Call queues and is answered within 60s',
    actual: 'Call was not answered — went to voicemail after 120s',
    status: 'fail',
    notes: 'Possible agent availability issue. Raised ticket #INC-20481. Overflow rule may not be configured.',
    datetime: '2024-11-10T14:15:00',
  },
  {
    name: 'Direct Dial Extension 2001',
    phone: '+44 20 7946 0300',
    extension: '2001',
    expected: 'Rings extension 2001 (J. Smith), answered within 4 rings',
    actual: 'Rang 6 times before answered — slight delay but correct destination',
    status: 'warning',
    notes: 'Ring time slightly over SLA of 4 rings. May be a softphone wake issue.',
    datetime: '2024-11-08T09:45:00',
  },
  {
    name: 'Conference Bridge PIN Test',
    phone: '+44 20 7946 0500',
    extension: 'Conference',
    expected: 'Bridge prompts for PIN, accepts 1234#, plays hold music',
    actual: 'PIN accepted, hold music playing correctly',
    status: 'pass',
    notes: 'All conference bridge functions operating normally.',
    datetime: '2024-11-07T15:00:00',
  },
  {
    name: 'Emergency Line — 24/7 Check',
    phone: '+44 20 7946 0999',
    extension: 'Emergency',
    expected: 'Answered immediately by on-call engineer',
    actual: 'Answered in 3s — correct team and greeting',
    status: 'pass',
    notes: 'Emergency line validated. On-call engineer confirmed.',
    datetime: '2024-11-10T02:00:00',
  },
];

/** Build a phone test result entry from raw form values. */
function buildPhoneEntry(formValues) {
  return {
    id: genId(),
    type: 'phone',
    target: formValues.phone,
    status: formValues.status,
    summary: `${formValues.name} — ${formValues.expected}`,
    timestamp: formValues.datetime
      ? new Date(formValues.datetime).toISOString()
      : new Date().toISOString(),
    data: { ...formValues },
  };
}
