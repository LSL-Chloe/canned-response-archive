#!/usr/bin/env node
/** Value-redacted scan of reachable Git history. GitHub's built-in secret scanning
 * should be used as well; this only identifies high-confidence credential formats. */
import { spawnSync } from 'node:child_process';

const result = spawnSync('git', [
  'log', '--all', '--format=GIT_AUDIT_COMMIT:%H', '--no-ext-diff',
  '--no-renames', '--patch', '--no-color',
], { encoding: 'utf8', maxBuffer: 128 * 1024 * 1024 });
if (result.status !== 0 || result.error) {
  console.error('Git history scan could not complete');
  process.exitCode = 2;
} else {
  const rules = [
    ['Supabase secret key', /sb_secret_[A-Za-z0-9_-]{18,}/g],
    ['GitHub access token', /(?:ghp_|gho_|ghu_|ghs_|github_pat_)[A-Za-z0-9_]{18,}/g],
    ['Google API key', /AIza[A-Za-z0-9_-]{30,}/g],
    ['AWS access key', /(?:AKIA|ASIA)[A-Z0-9]{16}/g],
    ['Private key header', /-----BEGIN (?:RSA |DSA |EC |OPENSSH )?PRIVATE KEY-----/g],
    ['JWT-like credential', /eyJ[A-Za-z0-9_-]{50,}\.eyJ[A-Za-z0-9_-]{50,}\.[A-Za-z0-9_-]{20,}/g],
  ];
  const placeholder = /YOUR|REPLACE|EXAMPLE|DUMMY|PLACEHOLDER|SAMPLE|NOT_REAL/i;
  const findings = [];
  let commit = 'unknown';
  let path = '';
  let commits = 0;
  let additions = 0;
  for (const line of result.stdout.split('\n')) {
    if (line.startsWith('GIT_AUDIT_COMMIT:')) {
      commit = line.slice('GIT_AUDIT_COMMIT:'.length, 'GIT_AUDIT_COMMIT:'.length + 12);
      commits++;
      continue;
    }
    if (line.startsWith('+++ b/')) {
      path = line.slice(6);
      if (/(?:^|\/)(?:\.env(?:\..+)?|\.dev\.vars|credentials\.json|secrets\.json)$|(?:\.pem|\.pfx|\.p12|\.key)$/i.test(path)
          && !/\.example$|\.sample$/i.test(path)) {
        findings.push({ commit, path, type: 'sensitive filename' });
      }
      continue;
    }
    if (!line.startsWith('+') || line.startsWith('+++')) continue;
    additions++;
    for (const [type, regex] of rules) {
      regex.lastIndex = 0;
      for (const match of line.slice(1).matchAll(regex)) {
        if (!placeholder.test(match[0])) findings.push({ commit, path, type });
      }
    }
  }
  console.log('History commits scanned:', commits);
  console.log('Added lines analyzed:', additions);
  console.log('Potential credential findings:', findings.length);
  for (const { commit, path, type } of findings.slice(0, 30)) {
    console.error('Potential ' + type + ' in ' + path + ' (' + commit + ')');
  }
  if (findings.length) {
    console.error('Review privately and rotate any real exposed credentials.');
    process.exitCode = 1;
  }
}
