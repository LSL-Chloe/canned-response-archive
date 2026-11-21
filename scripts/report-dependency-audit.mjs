#!/usr/bin/env node
// Summarize npm's audit without printing the complete dependency tree.
import { readFileSync, appendFileSync } from 'node:fs';

const [file, mode = 'all'] = process.argv.slice(2);
if (!file) throw new Error('Missing audit JSON and mode');
let audit;
try { audit = JSON.parse(readFileSync(file, 'utf8')); }
catch { console.error('npm audit did not return parseable JSON'); process.exit(2); }
if (audit.error) { console.error('npm audit unavailable: ' + String(audit.error.code || 'unknown')); process.exit(2); }
const levels = audit.metadata?.vulnerabilities || {};
const packages = Object.entries(audit.vulnerabilities || {})
  .filter(([, value]) => value && ['high', 'critical'].includes(value.severity))
  .map(([name, value]) => ({ name, severity: value.severity, fixAvailable: !!value.fixAvailable }));
const heading = mode === 'production' ? 'Production npm dependencies' : 'Full dependency tree including build tools';
const result = [
  '### ' + heading, '',
  '- Critical: ' + (levels.critical || 0),
  '- High: ' + (levels.high || 0),
  '- Moderate: ' + (levels.moderate || 0),
  '- Low: ' + (levels.low || 0), '',
  ...packages.slice(0, 30).map(p => '- ' + p.severity + ': ' + p.name +
    ' (automatic fix: ' + p.fixAvailable + ')'),
  '',
].join('\n');
console.log(result);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, result);
if (mode === 'production' && ((levels.critical || 0) + (levels.high || 0) > 0)) {
  console.error('High/critical production dependency advisory needs review.');
  process.exitCode = 1;
}
