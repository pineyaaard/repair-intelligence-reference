#!/usr/bin/env node
import { readFile, readdir } from 'node:fs/promises';
import { extname, join, relative } from 'node:path';
import process from 'node:process';

const root = process.cwd();
const scannerPaths = new Set([
  join(root, 'scripts', 'public-scope-scan.js'),
  join(root, 'scripts', 'secret-scan.js')
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
const textNames = new Set(['.gitignore', 'LICENSE']);

const rules = [
  { id: 'private-key', pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/g },
  { id: 'ssh-public-key', pattern: /\bssh-(?:rsa|ed25519)\s+[A-Za-z0-9+/=]{30,}/g },
  { id: 'cloud-access-key', pattern: /\bAKIA[A-Z0-9]{16}\b/g },
  { id: 'github-token', pattern: /\bgh[oprsu]_[A-Za-z0-9_]{30,}\b/g },
  { id: 'openai-key', pattern: /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/g },
  { id: 'jwt', pattern: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g },
  { id: 'literal-bearer-token', pattern: /\bBearer\s+[A-Za-z0-9_-]{20,}\b/g },
  {
    id: 'assigned-secret',
    pattern: /(?:api[_-]?key|client[_-]?secret|password|access[_-]?token)\s*[:=]\s*["'][^"'\s]{12,}["']/gi
  }
];

async function walk(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (['.git', 'node_modules', 'coverage'].includes(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(path)));
    else if (
      entry.isFile() &&
      !scannerPaths.has(path) &&
      (
        entry.name === '.env' ||
        entry.name.startsWith('.env.') ||
        textNames.has(entry.name) ||
        textExtensions.has(extname(entry.name))
      )
    ) {
      files.push(path);
    }
  }
  return files;
}

const findings = [];
for (const path of await walk(root)) {
  const content = await readFile(path, 'utf8');
  for (const rule of rules) {
    rule.pattern.lastIndex = 0;
    const match = rule.pattern.exec(content);
    if (match?.index !== undefined) {
      findings.push({
        file: relative(root, path),
        line: content.slice(0, match.index).split('\n').length,
        rule: rule.id
      });
    }
  }
}

if (findings.length > 0) {
  console.error('Secret scan failed. Remove every flagged value before publication.');
  for (const finding of findings) {
    console.error(`${finding.file}:${finding.line} (${finding.rule})`);
  }
  process.exit(1);
}

console.log('Secret scan passed: no credential-shaped values were found.');
