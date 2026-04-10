# FormFlow Tester

> A professional, config-driven automated website & form testing tool built with **Node.js**, **TypeScript**, and **Playwright**.

[![FormFlow Tester](https://img.shields.io/badge/FormFlow-Tester-blue?style=flat-square&logo=playwright)](https://github.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?style=flat-square&logo=typescript)](https://typescriptlang.org)
[![Playwright](https://img.shields.io/badge/Playwright-1.59-45ba4b?style=flat-square&logo=playwright)](https://playwright.dev)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)](LICENSE)

---

## Features

| Feature | Description |
|---|---|
| 🎭 Real browser testing | Chromium, Firefox, WebKit via Playwright |
| 📋 Config-driven | JSON or YAML flow definitions — no code edits needed |
| 🔄 Multi-step forms | Supports wizard-style forms with ordered steps |
| 🤖 CAPTCHA detection | Detects reCAPTCHA, hCaptcha, Cloudflare challenges — marks as **Manual Check Required** |
| 📸 Screenshots | Auto-captured on failure; optional on success and per-step |
| 📊 HTML reports | Clean, interactive per-run HTML reports |
| 🗃️ CSV/JSON export | Machine-readable results for further processing |
| 🔁 Retry logic | Configurable per-flow retry count |
| 🏷️ Tagging | Tag flows (e.g. `login`, `contact`, `smoke`) and filter results |
| 📡 Webhook support | POST results to any URL (Slack, Teams, custom) |
| 🚀 GitHub Actions | CI workflow with artifact upload & GitHub Pages deploy |
| 📱 Mobile-friendly dashboard | Responsive HTML/CSS/JS dashboard |

---

## Project Structure

```
formflow-tester/
├── src/
│   ├── index.ts           # CLI entry point
│   ├── runner.ts          # Core test runner
│   ├── reporter.ts        # HTML report & CSV generator
│   ├── captchaDetector.ts # CAPTCHA detection (no bypassing)
│   ├── configLoader.ts    # JSON / YAML config loader
│   ├── types.ts           # TypeScript interfaces
│   └── utils.ts           # Utility helpers
├── config/
│   ├── default.json       # Default smoke test (example.com)
│   ├── contact-form.json  # Contact form test
│   ├── multi-step-form.yaml
│   ├── newsletter.json
│   └── login-smoke.json   # Login smoke test (uses env vars for credentials)
├── dashboard/
│   ├── index.html         # Interactive dashboard
│   ├── style.css
│   └── app.js
├── reports/               # Generated HTML reports (git-ignored)
├── screenshots/           # Failure & step screenshots (git-ignored)
├── .github/
│   └── workflows/
│       └── formflow.yml   # GitHub Actions CI/CD workflow
├── package.json
├── tsconfig.json
└── README.md
```

---

## Quick Start

### Prerequisites

- **Node.js** ≥ 18
- **npm** ≥ 9

### Installation

```bash
# Clone the repository
git clone https://github.com/your-org/your-repo.git
cd your-repo

# Install dependencies
npm install

# Install Playwright browsers
npx playwright install --with-deps chromium
```

### Build

```bash
npm run build
```

### Run Tests

```bash
# Run the default config (config/default.json)
node dist/index.js

# Run a specific config
node dist/index.js --config config/contact-form.json

# Run multiple configs
node dist/index.js --config config/contact-form.json --config config/newsletter.json
```

### View Reports

After a run, open the generated HTML report:

```bash
open reports/report-*.html     # macOS
start reports/report-*.html   # Windows
xdg-open reports/report-*.html # Linux
```

Or open `dashboard/index.html` in a browser and click **Load JSON Report** to load a `latest.json` file from the `reports/` folder.

---

## Config File Format

Config files can be **JSON** or **YAML**. The top-level structure is a `SuiteConfig`:

```jsonc
{
  "suiteName": "My Test Suite",
  "browser": "chromium",          // "chromium" | "firefox" | "webkit"
  "headless": true,
  "viewport": { "width": 1280, "height": 800 },
  "reportDir": "reports",
  "screenshotDir": "screenshots",
  "webhookUrl": "",               // optional — POST results here
  "flows": [ /* see below */ ]
}
```

### Flow Config

```jsonc
{
  "id": "unique-flow-id",
  "name": "Human-readable Name",
  "tags": ["smoke", "form"],
  "url": "https://example.com/contact",
  "expectedTitle": "Contact Us",   // optional — must appear in <title>
  "expectedText": "Get in touch",  // optional — must appear on page
  "retries": 1,                    // optional — default 0
  "timeout": 30000,                // optional — ms per action
  "screenshotOnFailure": true,     // optional — default true
  "screenshotOnSuccess": false,    // optional — default false
  "steps": [ /* see below */ ]
}
```

### Step Config

```jsonc
{
  "name": "Fill contact fields",
  "fields": [
    { "selector": "#name",    "type": "text",     "value": "Jane Smith" },
    { "selector": "#email",   "type": "email",    "value": "jane@example.com" },
    { "selector": "#message", "type": "textarea", "value": "Hello!" },
    { "selector": "#country", "type": "select",   "value": "United Kingdom" },
    { "selector": "#agree",   "type": "checkbox", "value": "true" }
  ],
  "clicks": [
    { "selector": "button[type='submit']", "description": "Submit", "waitAfter": 2000 }
  ],
  "expectedText": "Thank you",    // optional — must appear after step
  "waitAfter": 1000,              // optional — ms to wait after step
  "screenshot": true              // optional — capture screenshot after step
}
```

### Field Types

| Type | Description |
|---|---|
| `text` / `email` / `password` / `tel` / `number` | Standard text inputs — `fill()` is used |
| `textarea` | Multi-line text area |
| `select` | `<select>` dropdown — matched by visible label |
| `checkbox` | Checked when value is `"true"` or `"1"` or `"checked"` |
| `radio` | Same as checkbox |
| `file` | File upload — value must be an absolute path |

---

## CAPTCHA Handling

FormFlow Tester **never** attempts to bypass CAPTCHAs. When a CAPTCHA is detected:

1. The current flow is stopped immediately.
2. The flow status is set to **`manual-check-required`**.
3. A screenshot is saved.
4. The report clearly marks the flow with a ⚠️ badge.

Detected indicators include:

- Google reCAPTCHA (`iframe[src*="recaptcha"]`, `.g-recaptcha`)
- hCaptcha (`iframe[src*="hcaptcha"]`, `.h-captcha`)
- Cloudflare Turnstile / challenge pages
- Page title patterns: "Just a moment", "Attention Required", "Access Denied"
- Body text patterns: "I'm not a robot", "Verify you're human", "DDoS protection"

---

## Environment Variables

Never hard-code secrets in config files. Use environment variables:

| Variable | Purpose |
|---|---|
| `TEST_USERNAME` | Login username for auth tests |
| `TEST_PASSWORD` | Login password for auth tests |
| `WEBHOOK_URL` | Webhook URL to POST results to |

Set these in your shell or in GitHub repository secrets.

---

## GitHub Actions

The workflow at `.github/workflows/formflow.yml`:

1. Installs dependencies and Playwright browsers
2. Builds TypeScript
3. Runs tests (default or custom config)
4. Uploads `reports/` and `screenshots/` as workflow artifacts
5. Deploys the dashboard + latest report to **GitHub Pages** (on pushes to `main`)

### Setting up GitHub Pages

1. Go to **Settings → Pages** in your repository.
2. Set source to **Deploy from a branch** → `gh-pages` → `/ (root)`.
3. The first workflow run will create the `gh-pages` branch automatically.

### Manual trigger

Run any config file via **Actions → FormFlow Tester → Run workflow** and provide the config path.

### Secrets

Add these in **Settings → Secrets and variables → Actions**:

| Secret | Required |
|---|---|
| `TEST_USERNAME` | Only if using login tests |
| `TEST_PASSWORD` | Only if using login tests |
| `WEBHOOK_URL` | Only if using webhook notifications |

---

## Dashboard

Open `dashboard/index.html` in any modern browser.

- **Automatic loading**: When served via HTTP (e.g., GitHub Pages), the dashboard tries to fetch `../reports/latest.json` automatically.
- **Manual loading**: Click **Load JSON Report** to load any `results-*.json` file from your reports folder.
- **Filtering**: Use the filter buttons to show only Pass / Fail / Manual Check flows.
- **Step details**: Click any flow card to expand step-by-step results.

---

## Development

```bash
# Watch and rebuild on changes
npx tsc --watch

# Run with ts-node (no build step)
npx ts-node src/index.ts --config config/default.json
```

---

## Adding New Test Flows

1. Create a new config file in `config/` (JSON or YAML).
2. Add one or more flows following the schema above.
3. Run: `node dist/index.js --config config/your-new-config.json`

No code changes required.

---

## License

MIT — see [LICENSE](LICENSE).
