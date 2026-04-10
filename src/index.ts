#!/usr/bin/env node
/**
 * FormFlow Tester — CLI Entry Point
 *
 * Usage:
 *   node dist/index.js                             # runs config/default.json
 *   node dist/index.js --config path/to/cfg        # runs a specific config
 *   node dist/index.js --config c1.json --config c2.yaml  # multiple configs
 *   node dist/index.js --config cfg.json --tag smoke       # only smoke-tagged flows
 *   node dist/index.js --config cfg.json --site tutorcare  # only tutorcare flows
 *   node dist/index.js --config cfg.json --tag smoke --tag daily  # OR filter
 */

import path from 'path';
import { loadConfig } from './configLoader';
import { runSuite } from './runner';
import { generateReport } from './reporter';
import { projectPath } from './utils';

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const configPaths: string[] = [];
  const tagFilters: string[] = [];
  const siteFilters: string[] = [];

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--config' && args[i + 1]) {
      configPaths.push(args[i + 1]);
      i++;
    } else if (args[i] === '--tag' && args[i + 1]) {
      tagFilters.push(args[i + 1].toLowerCase());
      i++;
    } else if (args[i] === '--site' && args[i + 1]) {
      siteFilters.push(args[i + 1].toLowerCase());
      i++;
    }
  }

  // Default: try config/default.json then config/default.yaml
  if (configPaths.length === 0) {
    const defaults = [
      projectPath('config', 'default.json'),
      projectPath('config', 'default.yaml'),
    ];
    for (const p of defaults) {
      const fs = await import('fs');
      if (fs.existsSync(p)) {
        configPaths.push(p);
        break;
      }
    }
  }

  if (configPaths.length === 0) {
    console.error('❌  No config file found. Pass --config <path> or create config/default.json');
    process.exit(1);
  }

  let exitCode = 0;

  for (const cfgPath of configPaths) {
    console.log(`\n📂 Loading config: ${path.resolve(cfgPath)}`);
    const config = loadConfig(cfgPath);

    // Apply tag / site filters
    if (tagFilters.length > 0 || siteFilters.length > 0) {
      const before = config.flows.length;
      config.flows = config.flows.filter((flow) => {
        const flowTags = (flow.tags ?? []).map((t) => t.toLowerCase());
        const flowSite = (flow.siteId ?? '').toLowerCase();

        const tagMatch = tagFilters.length === 0 || tagFilters.some((t) => flowTags.includes(t));
        const siteMatch = siteFilters.length === 0 || siteFilters.includes(flowSite);

        return tagMatch && siteMatch;
      });

      const labels: string[] = [];
      if (tagFilters.length > 0) labels.push(`tags=[${tagFilters.join(',')}]`);
      if (siteFilters.length > 0) labels.push(`site=[${siteFilters.join(',')}]`);
      console.log(`🔍 Filter (${labels.join(' ')}) — ${config.flows.length}/${before} flows selected`);

      if (config.flows.length === 0) {
        console.warn(`⚠️  No flows match the given filters — skipping this config`);
        continue;
      }
    }

    const result = await runSuite(config);
    const reportDir = path.resolve(config.reportDir ?? projectPath('reports'));
    const reportFile = generateReport(result, reportDir);
    console.log(`\n🔗 Report: ${reportFile}`);

    if (result.totals.fail > 0) exitCode = 1;
  }

  process.exit(exitCode);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
