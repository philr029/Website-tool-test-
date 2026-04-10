/**
 * FormFlow Tester — CAPTCHA Detector
 * Detects common CAPTCHA / bot-challenge indicators without bypassing them.
 */

import { Page } from 'playwright';

export interface CaptchaDetectionResult {
  detected: boolean;
  reason?: string;
}

/** Known CAPTCHA / challenge selectors */
const CAPTCHA_SELECTORS = [
  // Google reCAPTCHA
  'iframe[src*="recaptcha"]',
  '.g-recaptcha',
  '#recaptcha',
  // hCaptcha
  'iframe[src*="hcaptcha"]',
  '.h-captcha',
  // Cloudflare Turnstile
  '.cf-turnstile',
  'iframe[src*="challenges.cloudflare.com"]',
  // Generic
  '[class*="captcha"]',
  '[id*="captcha"]',
  '[name*="captcha"]',
];

/** Known CAPTCHA / challenge page text patterns */
const CAPTCHA_TEXT_PATTERNS = [
  /i[''`]?m not a robot/i,
  /verify you[''`]?re human/i,
  /human verification/i,
  /security check/i,
  /cloudflare/i,
  /ddos protection/i,
  /prove you[''`]?re not a robot/i,
  /complete the captcha/i,
  /captcha required/i,
  /are you a robot/i,
  /bot detection/i,
  /just a moment/i, // Cloudflare "Just a moment..." page
];

/** Known CAPTCHA page titles */
const CAPTCHA_TITLE_PATTERNS = [
  /attention required/i,
  /just a moment/i,
  /access denied/i,
  /security check/i,
  /ddos protection/i,
];

export async function detectCaptcha(page: Page): Promise<CaptchaDetectionResult> {
  // 1. Check page title
  try {
    const title = await page.title();
    for (const pattern of CAPTCHA_TITLE_PATTERNS) {
      if (pattern.test(title)) {
        return {
          detected: true,
          reason: `CAPTCHA detected — suspicious page title: "${title}"`,
        };
      }
    }
  } catch {
    // ignore title fetch errors
  }

  // 2. Check DOM selectors
  for (const sel of CAPTCHA_SELECTORS) {
    try {
      const el = await page.$(sel);
      if (el) {
        return {
          detected: true,
          reason: `CAPTCHA detected — element found matching selector: ${sel}`,
        };
      }
    } catch {
      // selector may be unsupported in some contexts — skip
    }
  }

  // 3. Check visible page text
  try {
    const bodyText = await page.evaluate(() => document.body?.innerText ?? '');
    for (const pattern of CAPTCHA_TEXT_PATTERNS) {
      if (pattern.test(bodyText)) {
        return {
          detected: true,
          reason: `CAPTCHA detected — text pattern matched: ${pattern.toString()}`,
        };
      }
    }
  } catch {
    // ignore text extraction errors
  }

  return { detected: false };
}
