import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

const repositoryRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const publicScopeScanner = join(repositoryRoot, 'scripts', 'public-scope-scan.js');
const secretScanner = join(repositoryRoot, 'scripts', 'secret-scan.js');

async function temporaryFixture(t) {
  const directory = await mkdtemp(join(tmpdir(), 'repair-reference-scanner-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return directory;
}

function runScanner(script, cwd, extraEnv = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script], {
      cwd,
      env: {
        ...process.env,
        PUBLIC_SCOPE_REQUIRE_PRIVATE_DENYLIST: '',
        PUBLIC_SCOPE_PRIVATE_DENYLIST_PATH: '',
        ...extraEnv
      }
    });
    const stdout = [];
    const stderr = [];
    child.stdout.on('data', (chunk) => stdout.push(chunk));
    child.stderr.on('data', (chunk) => stderr.push(chunk));
    child.on('error', reject);
    child.on('close', (code) => {
      resolve({
        code,
        stdout: Buffer.concat(stdout).toString('utf8'),
        stderr: Buffer.concat(stderr).toString('utf8')
      });
    });
  });
}

test('public-scope scanner inspects script, config, markup, and env text files', async (t) => {
  const fixture = await temporaryFixture(t);
  const privateTerm = ['fixture', 'private', 'label', '9472'].join('-');
  await writeFile(join(fixture, '.private-public-scope-denylist.txt'), `${privateTerm}\n`);

  const extensions = ['.mjs', '.cjs', '.ts', '.tsx', '.sh', '.toml', '.svg', '.xml'];
  for (const extension of extensions) {
    await writeFile(join(fixture, `candidate${extension}`), `label=${privateTerm}\n`);
  }
  await writeFile(join(fixture, '.env'), `LABEL=${privateTerm}\n`);
  await writeFile(join(fixture, '.env.local'), `LABEL=${privateTerm}\n`);

  const result = await runScanner(publicScopeScanner, fixture, {
    PUBLIC_SCOPE_REQUIRE_PRIVATE_DENYLIST: '1'
  });
  const output = `${result.stdout}${result.stderr}`;

  assert.equal(result.code, 1);
  for (const extension of extensions) assert.match(output, new RegExp(`candidate\\${extension}:1`));
  assert.match(output, /\.env:1/);
  assert.match(output, /\.env\.local:1/);
  assert.match(output, /private-denylist-01/);
  assert.equal(output.includes(privateTerm), false);
});

test('secret scanner rejects credential shapes in accidental env and mjs files', async (t) => {
  const fixture = await temporaryFixture(t);
  const fakeKey = ['sk', 'proj', 'A'.repeat(32)].join('-');
  await writeFile(join(fixture, '.env'), `OPENAI_API_KEY=${fakeKey}\n`);
  await writeFile(join(fixture, '.env.production'), `OPENAI_API_KEY=${fakeKey}\n`);
  await writeFile(join(fixture, 'record-demo.mjs'), `const token = '${fakeKey}';\n`);

  const result = await runScanner(secretScanner, fixture);
  const output = `${result.stdout}${result.stderr}`;

  assert.equal(result.code, 1);
  assert.match(output, /\.env:1 \(openai-key\)/);
  assert.match(output, /\.env\.production:1 \(openai-key\)/);
  assert.match(output, /record-demo\.mjs:1 \(openai-key\)/);
  assert.equal(output.includes(fakeKey), false);
});

test('.env.example is scanned and passes only while it remains secret-free', async (t) => {
  const fixture = await temporaryFixture(t);
  const examplePath = join(fixture, '.env.example');
  await writeFile(examplePath, 'OPENAI_API_KEY=\nSAFETY_ID_SALT=\n');

  const safeResult = await runScanner(secretScanner, fixture);
  assert.equal(safeResult.code, 0);

  const fakeKey = ['sk', 'proj', 'B'.repeat(32)].join('-');
  await writeFile(examplePath, `OPENAI_API_KEY=${fakeKey}\n`);
  const unsafeResult = await runScanner(secretScanner, fixture);
  const output = `${unsafeResult.stdout}${unsafeResult.stderr}`;

  assert.equal(unsafeResult.code, 1);
  assert.match(output, /\.env\.example:1 \(openai-key\)/);
  assert.equal(output.includes(fakeKey), false);
});
