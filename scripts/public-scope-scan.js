#!/usr/bin/env node
import { readFile, readdir } from 'node:fs/promises';
import { extname, join, relative, resolve } from 'node:path';
import process from 'node:process';

const root = process.cwd();
const privateDenylistPath = process.env.PUBLIC_SCOPE_PRIVATE_DENYLIST_PATH
  ? resolve(process.env.PUBLIC_SCOPE_PRIVATE_DENYLIST_PATH)
  : join(root, '.private-public-scope-denylist.txt');
const scannerPaths = new Set([
  join(root, 'scripts', 'public-scope-scan.js'),
  join(root, 'scripts', 'secret-scan.js'),
  privateDenylistPath
]);
const textExtensions = new Set([
  '.bash',
  '.cjs',
  '.css',
  '.cts',
  '.example',
  '.html',
  '.js',
  '.json',
  '.jsx',
  '.md',
  '.mjs',
  '.mts',
  '.sh',
  '.svg',
  '.toml',
  '.ts',
  '.tsx',
  '.txt',
  '.xml',
  '.yaml',
  '.yml',
  '.zsh'
]);
const specialTextNames = new Set(['.gitignore', 'LICENSE']);

const genericRiskRules = [
  { id: 'private-key', pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { id: 'cloud-key-shape', pattern: /\bAKIA[A-Z0-9]{16}\b/ },
  { id: 'ssh-key-shape', pattern: /\bssh-(?:rsa|ed25519)\s+[A-Za-z0-9+/=]{30,}/ },
  { id: 'ipv4-address', pattern: /\b(?:\d{1,3}\.){3}\d{1,3}\b/ },
  { id: 'vehicle-identifier-shape', pattern: /\b[A-HJ-NPR-Z0-9]{17}\b/i }
];

const allowedNetworkCallFiles = new Set(['src/openaiPrefill.js', 'public/app.js']);
const allowedPublicUrls = [
  /^https:\/\/api\.openai\.com\/v1\/responses$/,
  /^https:\/\/developers\.openai\.com\//,
  /^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(?:\/.*)?$/,
  /^http:\/\/localhost(?::\d+)?(?:\/.*)?$/,
  /^http:\/\/local\.invalid$/
];

function shouldScan(name) {
  const envFile = name === '.env' || name.startsWith('.env.');
  return envFile || specialTextNames.has(name) || textExtensions.has(extname(name));
}

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (['.git', 'node_modules', 'coverage'].includes(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(path)));
    else if (entry.isFile() && shouldScan(entry.name) && !scannerPaths.has(path)) files.push(path);
  }
  return files;
}

function lineNumber(text, index) {
  return text.slice(0, index).split('\n').length;
}

async function readPrivateDenylist() {
  try {
    const content = await readFile(privateDenylistPath, 'utf8');
    return content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line !== '' && !line.startsWith('#'));
  } catch (error) {
    if (error?.code === 'ENOENT') return [];
    throw error;
  }
}

function privateTermMatch(content, term) {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const leftBoundary = /^[\p{L}\p{N}_]/u.test(term) ? '(?<![\\p{L}\\p{N}_])' : '';
  const rightBoundary = /[\p{L}\p{N}_]$/u.test(term) ? '(?![\\p{L}\\p{N}_])' : '';
  return content.match(new RegExp(`${leftBoundary}${escaped}${rightBoundary}`, 'iu'));
}

const findings = [];
const privateTerms = await readPrivateDenylist();
if (process.env.PUBLIC_SCOPE_REQUIRE_PRIVATE_DENYLIST === '1' && privateTerms.length === 0) {
  console.error('Public-scope scan failed because the required local private denylist is missing or empty.');
  process.exit(1);
}
for (const path of await walk(root)) {
  const content = await readFile(path, 'utf8');
  for (const [index, term] of privateTerms.entries()) {
    const match = privateTermMatch(content, term);
    if (match?.index !== undefined) {
      findings.push({
        file: relative(root, path),
        line: lineNumber(content, match.index),
        rule: `private-denylist-${String(index + 1).padStart(2, '0')}`
      });
    }
  }
  for (const rule of genericRiskRules) {
    const match = content.match(rule.pattern);
    if (match?.index !== undefined) {
      findings.push({ file: relative(root, path), line: lineNumber(content, match.index), rule: rule.id });
    }
  }

  for (const match of content.matchAll(/https?:\/\/[^\s)'"`<>]+/gi)) {
    const url = match[0].replace(/[.,;:]$/, '');
    if (!allowedPublicUrls.some((rule) => rule.test(url))) {
      findings.push({ file: relative(root, path), line: lineNumber(content, match.index), rule: 'unapproved-network-endpoint' });
    }
  }

  const relativePath = relative(root, path);
  const networkCall = content.match(/\b(?:fetch|websocket)\s*\(/i);
  if (networkCall?.index !== undefined && !allowedNetworkCallFiles.has(relativePath)) {
    findings.push({ file: relativePath, line: lineNumber(content, networkCall.index), rule: 'unapproved-network-call' });
  }
}

if (findings.length > 0) {
  console.error('Public-scope scan failed. Remove the flagged material before publishing.');
  for (const finding of findings) {
    console.error(`${finding.file}:${finding.line} (${finding.rule})`);
  }
  process.exit(1);
}

const privateDenylistStatus = privateTerms.length > 0
  ? ` Private denylist active (${privateTerms.length} rule${privateTerms.length === 1 ? '' : 's'}).`
  : ' No private denylist was present; run the documented prepublication setup before release.';
console.log(`Public-scope scan passed: only synthetic scope and explicitly approved OpenAI/local endpoints are present.${privateDenylistStatus}`);
