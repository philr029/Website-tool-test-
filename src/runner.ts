/**
 * FormFlow Tester — Main Test Runner
 */

import path from 'path';
import { chromium, firefox, webkit, Browser, BrowserContext, Page } from 'playwright';
import { SuiteConfig, FlowConfig, FlowResult, StepResult, SuiteResult, FlowStatus, StepStatus } from './types';
import { detectCaptcha } from './captchaDetector';
import { ensureDir, slugify, nowISO, sleep, writeJson, projectPath } from './utils';

// ─── Runner ────────────────────────────────────────────────────────────────────

export async function runSuite(config: SuiteConfig): Promise<SuiteResult> {
  const reportDir = path.resolve(config.reportDir ?? projectPath('reports'));
  const screenshotDir = path.resolve(config.screenshotDir ?? projectPath('screenshots'));

  ensureDir(reportDir);
  ensureDir(screenshotDir);

  const browserType = config.browser ?? 'chromium';
  const headless = config.headless !== false;

  console.log(`\n╔══════════════════════════════════════════════════╗`);
  console.log(`║  FormFlow Tester — ${config.suiteName}`);
  console.log(`║  Browser: ${browserType} | Headless: ${headless}`);
  console.log(`╚══════════════════════════════════════════════════╝\n`);

  const browserLauncher = { chromium, firefox, webkit }[browserType] ?? chromium;
  const browser: Browser = await browserLauncher.launch({
    headless,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const suiteStartedAt = nowISO();
  const suiteStart = Date.now();
  const flowResults: FlowResult[] = [];

  for (const flow of config.flows) {
    const result = await runFlow(flow, browser, screenshotDir, config);
    flowResults.push(result);
    printFlowSummary(result);
  }

  await browser.close();

  const suiteEnd = Date.now();

  const totals = {
    total: flowResults.length,
    pass: flowResults.filter((r) => r.status === 'pass').length,
    fail: flowResults.filter((r) => r.status === 'fail').length,
    manualCheckRequired: flowResults.filter((r) => r.status === 'manual-check-required').length,
  };

  const suiteResult: SuiteResult = {
    suiteName: config.suiteName,
    browser: browserType,
    startedAt: suiteStartedAt,
    finishedAt: nowISO(),
    durationMs: suiteEnd - suiteStart,
    totals,
    flows: flowResults,
  };

  // Persist JSON results
  const timestamp = suiteStartedAt.replace(/[:.]/g, '-');
  const jsonPath = path.join(reportDir, `results-${timestamp}.json`);
  writeJson(jsonPath, suiteResult);

  console.log(`\n📁 JSON results saved to: ${jsonPath}`);
  printSuiteSummary(suiteResult);

  // Optional webhook
  if (config.webhookUrl) {
    await sendWebhook(config.webhookUrl, suiteResult);
  }

  return suiteResult;
}

// ─── Flow Execution ────────────────────────────────────────────────────────────

async function runFlow(
  flow: FlowConfig,
  browser: Browser,
  screenshotDir: string,
  suiteConfig: SuiteConfig,
): Promise<FlowResult> {
  const maxRetries = flow.retries ?? 0;
  let lastResult: FlowResult | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      console.log(`  ↩ Retrying flow "${flow.name}" (attempt ${attempt + 1}/${maxRetries + 1})...`);
    }

    lastResult = await executeFlow(flow, browser, screenshotDir, suiteConfig);

    if (lastResult.status !== 'fail') break;
  }

  return lastResult!;
}

async function executeFlow(
  flow: FlowConfig,
  browser: Browser,
  screenshotDir: string,
  suiteConfig: SuiteConfig,
): Promise<FlowResult> {
  const flowStartedAt = nowISO();
  const flowStart = Date.now();
  const stepResults: StepResult[] = [];
  const timeout = flow.timeout ?? 30_000;
  const viewport = suiteConfig.viewport ?? { width: 1280, height: 800 };

  let context: BrowserContext | null = null;
  let page: Page | null = null;
  let overallStatus: FlowStatus = 'pass';
  let errorMessage: string | undefined;
  let screenshotPath: string | undefined;

  console.log(`\n▶ Flow: ${flow.name} (${flow.url})`);

  try {
    context = await browser.newContext({
      viewport,
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
        '(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    });
    page = await context.newPage();
    page.setDefaultTimeout(timeout);

    // ── Navigate ──────────────────────────────────────────────────────────────
    await page.goto(flow.url, { waitUntil: 'domcontentloaded', timeout });

    // CAPTCHA check after navigation
    const captchaCheck = await detectCaptcha(page);
    if (captchaCheck.detected) {
      screenshotPath = await captureScreenshot(page, screenshotDir, `${flow.id}-captcha`);
      return buildFlowResult(flow, 'manual-check-required', stepResults, flowStartedAt, flowStart, captchaCheck.reason, screenshotPath);
    }

    // ── Validate landing page ─────────────────────────────────────────────────
    if (flow.expectedTitle) {
      const title = await page.title();
      if (!title.includes(flow.expectedTitle)) {
        throw new Error(`Expected title to contain "${flow.expectedTitle}" but got "${title}"`);
      }
    }

    if (flow.expectedText) {
      await page.waitForSelector(`text=${flow.expectedText}`, { timeout }).catch(() => {
        throw new Error(`Expected text "${flow.expectedText}" not found on page`);
      });
    }

    // ── Execute Steps ─────────────────────────────────────────────────────────
    for (let i = 0; i < flow.steps.length; i++) {
      const step = flow.steps[i];
      const stepName = step.name ?? `Step ${i + 1}`;
      const stepStart = Date.now();
      let stepStatus: StepStatus = 'pass';
      let stepMessage: string | undefined;
      let stepScreenshot: string | undefined;

      console.log(`  ├─ ${stepName}`);

      try {
        // CAPTCHA check before each step
        const captcha = await detectCaptcha(page);
        if (captcha.detected) {
          stepScreenshot = await captureScreenshot(page, screenshotDir, `${flow.id}-step${i}-captcha`);
          stepStatus = 'captcha';
          stepMessage = captcha.reason;
          overallStatus = 'manual-check-required';
          stepResults.push(buildStepResult(i, stepName, stepStatus, stepMessage, stepScreenshot, stepStart));
          break;
        }

        // Process clicks
        if (step.clicks) {
          for (const click of step.clicks) {
            await performClick(page, click, timeout);
            if (click.waitAfter) await sleep(click.waitAfter);

            // CAPTCHA check after navigation-triggering clicks
            const postClickCaptcha = await detectCaptcha(page);
            if (postClickCaptcha.detected) {
              stepScreenshot = await captureScreenshot(page, screenshotDir, `${flow.id}-step${i}-captcha`);
              stepStatus = 'captcha';
              stepMessage = postClickCaptcha.reason;
              overallStatus = 'manual-check-required';
              break;
            }
          }
        }

        if (stepStatus === 'captcha') {
          stepResults.push(buildStepResult(i, stepName, stepStatus, stepMessage, stepScreenshot, stepStart));
          break;
        }

        // Fill form fields
        if (step.fields) {
          for (const field of step.fields) {
            if (field.waitBefore) await sleep(field.waitBefore);
            await fillField(page, field, timeout);
          }
        }

        // Assert expected text after step
        if (step.expectedText) {
          await page.waitForSelector(`text=${step.expectedText}`, { timeout }).catch(() => {
            throw new Error(`Expected text "${step.expectedText}" not found after step "${stepName}"`);
          });
        }

        // Screenshot after step
        if (step.screenshot || flow.screenshotOnSuccess) {
          stepScreenshot = await captureScreenshot(page, screenshotDir, `${flow.id}-step${i}-pass`);
        }

        // Wait after step
        if (step.waitAfter) await sleep(step.waitAfter);

        stepStatus = 'pass';
      } catch (err) {
        stepStatus = 'fail';
        stepMessage = err instanceof Error ? err.message : String(err);
        overallStatus = 'fail';

        if (flow.screenshotOnFailure !== false) {
          stepScreenshot = await captureScreenshot(page, screenshotDir, `${flow.id}-step${i}-fail`);
        }

        console.log(`  │  ✗ ${stepMessage}`);
      }

      stepResults.push(buildStepResult(i, stepName, stepStatus, stepMessage, stepScreenshot, stepStart));

      if (stepStatus === 'fail') break;
    }

    // Final screenshot on overall pass
    if (overallStatus === 'pass' && flow.screenshotOnSuccess) {
      screenshotPath = await captureScreenshot(page, screenshotDir, `${flow.id}-final-pass`);
    }
  } catch (err) {
    overallStatus = 'fail';
    errorMessage = err instanceof Error ? err.message : String(err);

    if (page && flow.screenshotOnFailure !== false) {
      screenshotPath = await captureScreenshot(page, screenshotDir, `${flow.id}-error`);
    }

    console.log(`  ✗ Flow error: ${errorMessage}`);
  } finally {
    if (context) await context.close().catch(() => null);
  }

  return buildFlowResult(flow, overallStatus, stepResults, flowStartedAt, flowStart, errorMessage, screenshotPath);
}

// ─── Field & Click Helpers ─────────────────────────────────────────────────────

async function fillField(page: Page, field: { selector: string; type: string; value: string }, timeout: number): Promise<void> {
  switch (field.type) {
    case 'checkbox':
    case 'radio': {
      const el = page.locator(field.selector).first();
      await el.waitFor({ state: 'visible', timeout });
      const checked = await el.isChecked();
      const shouldCheck = field.value === 'true' || field.value === '1' || field.value === 'checked';
      if (shouldCheck && !checked) await el.check();
      if (!shouldCheck && checked) await el.uncheck();
      break;
    }
    case 'select': {
      const sel = page.locator(field.selector).first();
      await sel.waitFor({ state: 'visible', timeout });
      await sel.selectOption({ label: field.value });
      break;
    }
    case 'file':
      // File upload: value should be an absolute path
      await page.setInputFiles(field.selector, field.value);
      break;
    default: {
      const input = page.locator(field.selector).first();
      await input.waitFor({ state: 'visible', timeout });
      await input.fill('');
      await input.fill(field.value);
      break;
    }
  }
}

async function performClick(page: Page, click: { selector: string; description?: string; newTab?: boolean }, timeout: number): Promise<void> {
  // Try by CSS selector first; if that fails, try by text content
  let locator = page.locator(click.selector).first();

  try {
    await locator.waitFor({ state: 'visible', timeout });
  } catch {
    // Fallback: try text match
    locator = page.getByText(click.selector, { exact: false }).first();
    await locator.waitFor({ state: 'visible', timeout });
  }

  if (click.newTab) {
    const [newPage] = await Promise.all([
      page.context().waitForEvent('page'),
      locator.click(),
    ]);
    await newPage.waitForLoadState('domcontentloaded');
    // We stay on the original page; the caller can extend this if needed
  } else {
    await locator.click();
    await page.waitForLoadState('domcontentloaded', { timeout }).catch(() => null);
  }
}

// ─── Screenshot ────────────────────────────────────────────────────────────────

async function captureScreenshot(page: Page, screenshotDir: string, name: string): Promise<string> {
  const filename = `${slugify(name)}-${Date.now()}.png`;
  const fullPath = path.join(screenshotDir, filename);
  ensureDir(screenshotDir);
  await page.screenshot({ path: fullPath, fullPage: true }).catch(() => null);
  return fullPath;
}

// ─── Builders ─────────────────────────────────────────────────────────────────

function buildStepResult(
  index: number,
  name: string,
  status: StepStatus,
  message: string | undefined,
  screenshotPath: string | undefined,
  startMs: number,
): StepResult {
  return { stepIndex: index, stepName: name, status, message, screenshotPath, durationMs: Date.now() - startMs };
}

function buildFlowResult(
  flow: FlowConfig,
  status: FlowStatus,
  steps: StepResult[],
  startedAt: string,
  startMs: number,
  errorMessage?: string,
  screenshotPath?: string,
): FlowResult {
  return {
    flowId: flow.id,
    flowName: flow.name,
    tags: flow.tags ?? [],
    url: flow.url,
    status,
    steps,
    screenshotPath,
    errorMessage,
    startedAt,
    finishedAt: nowISO(),
    durationMs: Date.now() - startMs,
  };
}

// ─── Console Output ────────────────────────────────────────────────────────────

function printFlowSummary(result: FlowResult): void {
  const icon = result.status === 'pass' ? '✅' : result.status === 'manual-check-required' ? '⚠️ ' : '❌';
  console.log(`  ${icon} ${result.flowName} — ${result.status.toUpperCase()} (${result.durationMs}ms)`);
}

function printSuiteSummary(suite: SuiteResult): void {
  console.log(`\n╔══════════════════════════════════════════════════╗`);
  console.log(`║  Suite: ${suite.suiteName}`);
  console.log(`║  Total: ${suite.totals.total} | ✅ Pass: ${suite.totals.pass} | ❌ Fail: ${suite.totals.fail} | ⚠️  Manual: ${suite.totals.manualCheckRequired}`);
  console.log(`║  Duration: ${suite.durationMs}ms`);
  console.log(`╚══════════════════════════════════════════════════╝\n`);
}

// ─── Webhook ───────────────────────────────────────────────────────────────────

async function sendWebhook(url: string, result: SuiteResult): Promise<void> {
  try {
    const https = await import('https');
    const http = await import('http');
    const body = JSON.stringify(result);
    const parsed = new URL(url);
    const client = parsed.protocol === 'https:' ? https : http;

    await new Promise<void>((resolve, reject) => {
      const req = (client as typeof https).request(
        { method: 'POST', hostname: parsed.hostname, path: parsed.pathname + parsed.search, headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } },
        (res) => { res.resume(); resolve(); },
      );
      req.on('error', reject);
      req.write(body);
      req.end();
    });

    console.log(`📡 Webhook sent to ${url}`);
  } catch (err) {
    console.warn(`⚠️  Webhook failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}
