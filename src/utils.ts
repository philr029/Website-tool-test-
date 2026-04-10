/**
 * FormFlow Tester — Utility Functions
 */

import fs from 'fs';
import path from 'path';

/** Ensure a directory exists, creating it recursively if needed. */
export function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/** Generate a filesystem-safe filename from an arbitrary string. */
export function slugify(text: string): string {
  const slug = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-');

  // Trim leading/trailing dashes without a regex to avoid ReDoS
  let start = 0;
  let end = slug.length;
  while (start < end && slug[start] === '-') start++;
  while (end > start && slug[end - 1] === '-') end--;

  return slug.slice(start, Math.min(end, start + 80));
}

/** Format a duration in milliseconds as a human-readable string. */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const minutes = Math.floor(ms / 60_000);
  const seconds = ((ms % 60_000) / 1000).toFixed(0);
  return `${minutes}m ${seconds}s`;
}

/** Return the current ISO 8601 timestamp. */
export function nowISO(): string {
  return new Date().toISOString();
}

/** Sleep for the given number of milliseconds. */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Write a JSON file, creating parent directories as needed. */
export function writeJson(filePath: string, data: unknown): void {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

/** Convert suite results to CSV rows. */
export function resultsToCsv(rows: Array<Record<string, string | number>>): string {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  const lines = [
    headers.join(','),
    ...rows.map((row) =>
      headers.map((h) => JSON.stringify(String(row[h] ?? ''))).join(',')
    ),
  ];
  return lines.join('\n');
}

/** Build an absolute path relative to the project root. */
export function projectPath(...parts: string[]): string {
  return path.resolve(__dirname, '..', ...parts);
}
