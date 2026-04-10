/**
 * FormFlow Tester — Type Definitions
 */

export type FieldType = 'text' | 'email' | 'password' | 'tel' | 'number' | 'textarea' | 'select' | 'checkbox' | 'radio' | 'file';

export interface FormField {
  /** CSS selector or label text for the field.
   *  Supports special prefixes handled by resolveLocator:
   *    label:<text>       → page.getByLabel(text, { exact: false })
   *    placeholder:<text> → page.getByPlaceholder(text, { exact: false })
   *    text:<text>        → page.getByText(text, { exact: false })
   *    (anything else)    → page.locator(selector)
   */
  selector: string;
  /** Type of the form field */
  type: FieldType;
  /** Value to fill / select / check */
  value: string;
  /** Optional: wait (ms) before interacting with this field */
  waitBefore?: number;
  /** If true, skip this field gracefully when the element is not found or not visible */
  optional?: boolean;
}

export interface ClickAction {
  /** CSS selector or text content of the element to click */
  selector: string;
  /** Human-readable description */
  description?: string;
  /** Wait (ms) after clicking */
  waitAfter?: number;
  /** If true, the click opens a new tab/page — runner will follow it */
  newTab?: boolean;
  /** Mark this click as the form's submit action.
   *  When the parent flow has validateOnly: true, submit actions are skipped. */
  isSubmit?: boolean;
}

export interface FormStep {
  /** Optional name for the step shown in reports */
  name?: string;
  /** Scroll to this selector (supports label:/placeholder:/text: prefixes) before processing the step */
  scrollTo?: string;
  /** Fields to fill in this step */
  fields?: FormField[];
  /** Buttons/links to click in this step */
  clicks?: ClickAction[];
  /** Text that must be visible after this step completes */
  expectedText?: string;
  /** Wait (ms) after completing this step */
  waitAfter?: number;
  /** Whether to take a screenshot after this step */
  screenshot?: boolean;
}

export interface FlowConfig {
  /** Unique identifier for the flow */
  id: string;
  /** Display name shown in reports */
  name: string;
  /** Tags used to filter / group tests */
  tags?: string[];
  /** Starting URL */
  url: string;
  /** Expected page <title> or heading text */
  expectedTitle?: string;
  /** Text expected anywhere on the landing page */
  expectedText?: string;
  /** Steps to execute in order */
  steps: FormStep[];
  /** Max retries on failure (default: 0) */
  retries?: number;
  /** Global timeout per step in ms (default: 30000) */
  timeout?: number;
  /** Take a screenshot on failure */
  screenshotOnFailure?: boolean;
  /** Take a screenshot on success */
  screenshotOnSuccess?: boolean;
  /** Fill and interact with all fields but skip any click marked isSubmit: true.
   *  Use this to verify form availability without generating real submissions.
   *  Default: false */
  validateOnly?: boolean;
  /** Permit actual form submission. Only takes effect when validateOnly is false.
   *  Default: false — forms are never submitted unless this is explicitly true. */
  submit?: boolean;
}

export interface SuiteConfig {
  /** Human-readable suite name */
  suiteName: string;
  /** Browser to use: chromium | firefox | webkit */
  browser?: 'chromium' | 'firefox' | 'webkit';
  /** Run browser in headless mode (default: true) */
  headless?: boolean;
  /** Viewport dimensions */
  viewport?: { width: number; height: number };
  /** Output directory for reports */
  reportDir?: string;
  /** Output directory for screenshots */
  screenshotDir?: string;
  /** Webhook URL to POST results to */
  webhookUrl?: string;
  /** List of flows to run */
  flows: FlowConfig[];
}

// ─── Result Types ──────────────────────────────────────────────────────────────

export type StepStatus = 'pass' | 'fail' | 'captcha' | 'skipped';
export type FlowStatus = 'pass' | 'fail' | 'manual-check-required' | 'partially-loaded';

export interface StepResult {
  stepIndex: number;
  stepName: string;
  status: StepStatus;
  message?: string;
  screenshotPath?: string;
  durationMs: number;
}

export interface FlowResult {
  flowId: string;
  flowName: string;
  tags: string[];
  url: string;
  status: FlowStatus;
  steps: StepResult[];
  screenshotPath?: string;
  errorMessage?: string;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
}

export interface SuiteResult {
  suiteName: string;
  browser: string;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  totals: {
    total: number;
    pass: number;
    fail: number;
    manualCheckRequired: number;
    partiallyLoaded: number;
  };
  flows: FlowResult[];
}
