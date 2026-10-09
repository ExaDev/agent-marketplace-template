import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { after, describe, it } from 'node:test';
import { makeTempDir, writeFiles } from './lib/fixture.ts';

const SCRIPTS = join(import.meta.dirname, '..', 'plugins', 'share-agent-setup', 'skills', 'share-agent-setup', 'scripts');
const LEAK_CHECK = join(SCRIPTS, 'leak-check.sh');
const SHARE_GIST = join(SCRIPTS, 'share-gist.sh');

const FIXTURE_USER = 'fixtureuser';
const FIXTURE_HOME = '/home/fixture-home';
const FIXTURE_EMAIL = 'fixture@example.invalid';

/** Characters after the prefix; the leak check's GitHub token pattern needs at least twenty. */
const TOKEN_BODY_LENGTH = 24;
/** A token-shaped value made of parts, so no complete credential-looking literal sits in this file. */
const TOKEN = ['gh', 'p_', 'A'.repeat(TOKEN_BODY_LENGTH)].join('');
const EXECUTABLE = 0o755;

const cleanups: (() => void)[] = [];

after(() => {
  for (const remove of cleanups) remove();
});

/** A throwaway directory with `files` written into it. */
function scratch(files: Readonly<Record<string, string>> = {}): string {
  const { dir, remove } = makeTempDir('share-agent-setup');

  cleanups.push(remove);
  writeFiles(dir, files);

  return dir;
}

/** An environment that fixes the identity the leak check looks for, whatever machine runs the test. */
function identityEnv(extra: Readonly<Record<string, string>> = {}): NodeJS.ProcessEnv {
  return {
    PATH: process.env.PATH,
    USER: FIXTURE_USER,
    HOME: FIXTURE_HOME,
    GIT_CONFIG_GLOBAL: '/dev/null',
    GIT_CONFIG_SYSTEM: '/dev/null',
    GIT_CONFIG_COUNT: '1',
    GIT_CONFIG_KEY_0: 'user.email',
    GIT_CONFIG_VALUE_0: FIXTURE_EMAIL,
    ...extra,
  };
}

interface Outcome {
  status: number | null;
  stdout: string;
  stderr: string;
}

function run(script: string, args: readonly string[], cwd: string, env: NodeJS.ProcessEnv): Outcome {
  const result = spawnSync('bash', [script, ...args], { cwd, encoding: 'utf8', env });
  if (result.error) throw result.error;

  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

void describe('leak-check.sh', () => {
  const check = (content: string): Outcome => run(LEAK_CHECK, ['piece.md'], scratch({ 'piece.md': content }), identityEnv());

  void it('passes a file with no personal detail', () => {
    assert.equal(check('A portable skill.\n').status, 0);
  });

  void it('flags the user name, the home directory and the git email', () => {
    assert.equal(check(`owner: ${FIXTURE_USER}\n`).status, 1);
    assert.equal(check(`path: ${FIXTURE_HOME}/notes\n`).status, 1);
    assert.equal(check(`contact ${FIXTURE_EMAIL}\n`).status, 1);
  });

  void it('flags a token-shaped string and never echoes it', () => {
    const result = check(`header: ${TOKEN}\n`);

    assert.equal(result.status, 1);
    assert.match(result.stderr, /piece\.md/);
    assert.match(result.stderr, /line\(s\) 1/);
    assert.ok(!(result.stdout + result.stderr).includes(TOKEN));
  });

  void it('matches the user name as a whole word only', () => {
    assert.equal(check(`${FIXTURE_USER}y and ${FIXTURE_USER}s\n`).status, 0);
  });

  void it('fails on a file it cannot read instead of passing it', () => {
    const result = run(LEAK_CHECK, ['missing.md'], scratch(), identityEnv());

    assert.equal(result.status, 2);
    assert.match(result.stderr, /missing\.md/);
  });

  void it('works when USER is not set', () => {
    const env = identityEnv();
    delete env.USER;

    assert.equal(run(LEAK_CHECK, ['piece.md'], scratch({ 'piece.md': 'A portable skill.\n' }), env).status, 0);
  });
});

void describe('share-gist.sh', () => {
  /** A directory holding a `gh` stand-in that logs each call and answers the gist listing with `existingId`. */
  function withFakeGh(existingId: string, content: string): { dir: string; env: NodeJS.ProcessEnv } {
    const dir = scratch({
      'bin/gh': [
        '#!/bin/bash',
        'echo "$*" >> calls.log',
        'if [ "$1" = "api" ]; then cat gist-id.txt; fi',
        'if [ "$1" = "gist" ] && [ "$2" = "create" ]; then cat > created.md; echo https://gist.example.invalid/new; fi',
        '',
      ].join('\n'),
      'gist-id.txt': existingId,
      'piece.md': content,
    });
    chmodSync(join(dir, 'bin', 'gh'), EXECUTABLE);

    return { dir, env: identityEnv({ PATH: `${join(dir, 'bin')}:${process.env.PATH ?? ''}` }) };
  }

  void it('refuses a file that fails the leak check and never calls gh', () => {
    const { dir, env } = withFakeGh('', `token ${TOKEN}\n`);
    const result = run(SHARE_GIST, ['piece.md', 'demo'], dir, env);

    assert.equal(result.status, 2);
    assert.match(result.stderr, /refusing/);
    assert.equal(existsSync(join(dir, 'calls.log')), false);
  });

  void it('creates a gist named for the slug, reading the file from stdin, when none exists', () => {
    const { dir, env } = withFakeGh('', 'A portable setup prompt.\n');
    const result = run(SHARE_GIST, ['piece.md', 'demo'], dir, env);

    assert.equal(result.status, 0);
    assert.match(readFileSync(join(dir, 'calls.log'), 'utf8'), /gist create - --filename demo-setup-prompt\.md --desc Setup prompt: demo/);
    assert.equal(readFileSync(join(dir, 'created.md'), 'utf8'), 'A portable setup prompt.\n');
    assert.match(result.stdout, /gist\.example\.invalid/);
  });

  void it('updates the existing gist instead of creating another', () => {
    const { dir, env } = withFakeGh('abc123\n', 'A portable setup prompt.\n');
    const result = run(SHARE_GIST, ['piece.md', 'demo'], dir, env);
    const calls = readFileSync(join(dir, 'calls.log'), 'utf8');

    assert.equal(result.status, 0);
    assert.match(calls, /gist edit abc123 --filename demo-setup-prompt\.md piece\.md/);
    assert.doesNotMatch(calls, /gist create/);
    assert.match(result.stdout, /gist\.github\.com\/abc123/);
  });

  void it('rejects a slug that is not a safe file name and never calls gh', () => {
    const { dir, env } = withFakeGh('', 'A portable setup prompt.\n');
    const result = run(SHARE_GIST, ['piece.md', 'a" or true or ".b'], dir, env);

    assert.equal(result.status, 2);
    assert.equal(existsSync(join(dir, 'calls.log')), false);
  });
});
