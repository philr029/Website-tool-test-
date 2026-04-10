/**
 * FormFlow Tester — Config Loader
 * Supports JSON and YAML suite config files.
 */

import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { SuiteConfig } from './types';

export function loadConfig(configPath: string): SuiteConfig {
  const abs = path.resolve(configPath);

  if (!fs.existsSync(abs)) {
    throw new Error(`Config file not found: ${abs}`);
  }

  const raw = fs.readFileSync(abs, 'utf-8');
  const ext = path.extname(abs).toLowerCase();

  let parsed: unknown;

  if (ext === '.json') {
    parsed = JSON.parse(raw);
  } else if (ext === '.yaml' || ext === '.yml') {
    parsed = yaml.load(raw);
  } else {
    throw new Error(`Unsupported config format: ${ext}. Use .json or .yaml/.yml`);
  }

  return validateConfig(parsed, abs);
}

function validateConfig(raw: unknown, filePath: string): SuiteConfig {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error(`Invalid config in ${filePath}: expected an object`);
  }

  const cfg = raw as Record<string, unknown>;

  if (!cfg.suiteName || typeof cfg.suiteName !== 'string') {
    throw new Error(`Config missing required field "suiteName" in ${filePath}`);
  }

  if (!Array.isArray(cfg.flows) || cfg.flows.length === 0) {
    throw new Error(`Config missing required field "flows" (non-empty array) in ${filePath}`);
  }

  for (const flow of cfg.flows as unknown[]) {
    validateFlow(flow, filePath);
  }

  return raw as SuiteConfig;
}

function validateFlow(raw: unknown, filePath: string): void {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error(`Each flow must be an object in ${filePath}`);
  }

  const f = raw as Record<string, unknown>;

  if (!f.id || typeof f.id !== 'string') {
    throw new Error(`Flow missing required field "id" in ${filePath}`);
  }
  if (!f.name || typeof f.name !== 'string') {
    throw new Error(`Flow "${f.id}" missing required field "name" in ${filePath}`);
  }
  if (!f.url || typeof f.url !== 'string') {
    throw new Error(`Flow "${f.id}" missing required field "url" in ${filePath}`);
  }
  if (!Array.isArray(f.steps)) {
    throw new Error(`Flow "${f.id}" missing required field "steps" (array) in ${filePath}`);
  }
}
