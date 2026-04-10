/**
 * FormFlow Tester — Form Field Resolution Helpers
 *
 * Provides resilient selector resolution backed by Playwright's semantic locators.
 *
 * Supported selector prefixes:
 *   label:<text>       → page.getByLabel(text, { exact: false })
 *   placeholder:<text> → page.getByPlaceholder(text, { exact: false })
 *   text:<text>        → page.getByText(text, { exact: false })
 *   (anything else)    → page.locator(selector)   ← standard CSS / XPath
 *
 * Why this matters
 * ----------------
 * Class names and IDs change with each CMS / framework update. Label text and
 * placeholder copy change far less often, so label-/placeholder-based selectors
 * are more stable for smoke tests against third-party sites.
 */

import { Page, Locator } from 'playwright';

// ─── Constants ─────────────────────────────────────────────────────────────────

/** Timeout used when checking visibility of optional fields (ms). */
export const OPTIONAL_FIELD_TIMEOUT_MS = 5_000;

/** Timeout cap used when scrolling to a landmark element (ms). */
export const SCROLL_TIMEOUT_MS = 10_000;

// ─── Selector Resolution ───────────────────────────────────────────────────────

/**
 * Convert a selector string into a Playwright Locator using the best strategy
 * for the given prefix. Always returns the first matching element.
 */
export function resolveLocator(page: Page, selector: string): Locator {
  if (selector.startsWith('label:')) {
    return page.getByLabel(selector.slice(6).trim(), { exact: false }).first();
  }
  if (selector.startsWith('placeholder:')) {
    return page.getByPlaceholder(selector.slice(12).trim(), { exact: false }).first();
  }
  if (selector.startsWith('text:')) {
    return page.getByText(selector.slice(5).trim(), { exact: false }).first();
  }
  return page.locator(selector).first();
}

// ─── Scroll Helper ─────────────────────────────────────────────────────────────

/**
 * Scroll a resolved element into the viewport. Best-effort — failures are
 * logged but do not abort the step.
 */
export async function scrollToLocator(page: Page, selector: string, timeout: number): Promise<void> {
  try {
    const locator = resolveLocator(page, selector);
    await locator.waitFor({ state: 'visible', timeout: Math.min(timeout, SCROLL_TIMEOUT_MS) });
    await locator.scrollIntoViewIfNeeded();
  } catch {
    // Non-fatal — page may already be scrolled, or element may be in a sticky section.
  }
}

// ─── Field Visibility Probe ────────────────────────────────────────────────────

/**
 * Check whether a resolved locator is visible within the given timeout.
 * Returns false (does not throw) when the element is absent or hidden.
 */
export async function isLocatorVisible(page: Page, selector: string, timeout: number): Promise<boolean> {
  try {
    const locator = resolveLocator(page, selector);
    await locator.waitFor({ state: 'visible', timeout: Math.min(timeout, OPTIONAL_FIELD_TIMEOUT_MS) });
    return true;
  } catch {
    return false;
  }
}
