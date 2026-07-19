import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { resolveExternalEnvFile } from '../scripts/run-with-external-env.js';

test('AI credentials must be loaded from an absolute file outside the repository', () => {
  const repositoryRoot = resolve('/workspace/reference-project');
  const externalFile = resolve('/workspace/private-config/repair-intelligence.env');

  assert.equal(resolveExternalEnvFile(externalFile, repositoryRoot), externalFile);
  assert.throws(
    () => resolveExternalEnvFile('repair-intelligence.env', repositoryRoot),
    /must be an absolute path/
  );
  assert.throws(
    () => resolveExternalEnvFile(resolve(repositoryRoot, '.env'), repositoryRoot),
    /must stay outside this repository/
  );
});
