#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { constants } from 'node:fs';
import { access } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(here, '..');
const allowedTargets = new Set(['src/server.js', 'scripts/live-ai-eval.js']);

export function resolveExternalEnvFile(value, root = repositoryRoot) {
  if (typeof value !== 'string' || value.trim() === '' || !isAbsolute(value)) {
    throw new Error('OPENAI_ENV_FILE must be an absolute path to a file outside this repository.');
  }
  const resolvedRoot = resolve(root);
  const resolvedFile = resolve(value);
  const pathFromRoot = relative(resolvedRoot, resolvedFile);
  const isInsideRoot = pathFromRoot === '' || (
    pathFromRoot !== '..' &&
    !pathFromRoot.startsWith(`..${sep}`) &&
    !isAbsolute(pathFromRoot)
  );
  if (isInsideRoot) {
    throw new Error('OPENAI_ENV_FILE must stay outside this repository so publication scans remain meaningful.');
  }
  return resolvedFile;
}

async function run() {
  const target = process.argv[2];
  if (!allowedTargets.has(target)) {
    throw new Error('The external environment launcher received an unsupported target.');
  }
  const envFile = resolveExternalEnvFile(process.env.OPENAI_ENV_FILE);
  try {
    await access(envFile, constants.R_OK);
  } catch {
    throw new Error('OPENAI_ENV_FILE must point to a readable file outside this repository.');
  }

  const childEnvironment = { ...process.env };
  delete childEnvironment.OPENAI_API_KEY;
  delete childEnvironment.OPENAI_MODEL;
  delete childEnvironment.SAFETY_ID_SALT;
  const child = spawn(
    process.execPath,
    [`--env-file=${envFile}`, resolve(repositoryRoot, target)],
    { cwd: repositoryRoot, env: childEnvironment, stdio: 'inherit' }
  );
  child.on('error', (error) => {
    console.error(`Could not start the requested process: ${error.message}`);
    process.exitCode = 1;
  });
  child.on('exit', (code, signal) => {
    process.exitCode = signal ? 1 : (code ?? 1);
  });
}

const isEntryPoint = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isEntryPoint) {
  run().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
