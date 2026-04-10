#!/usr/bin/env node
/**
 * FormFlow Tester — CLI Entry Point
 *
 * Usage:
 *   node dist/index.js                       # runs config/default.json
 *   node dist/index.js --config path/to/cfg  # runs a specific config
 *   node dist/index.js --config cfg1.json --config cfg2.yaml  # multiple configs
 */

import path from 'path';
import { loadConfig } from './configLoader';
import { runSuite } from './runner';
import { generateReport } from './reporter';
import { projectPath } from './utils';

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const configPaths: string[] = [];

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--config' && args[i + 1]) {
      configPaths.push(args[i + 1]);
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
