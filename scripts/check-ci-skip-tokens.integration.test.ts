import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { checkCiSkipTokens } from './check-ci-skip-tokens.ts';
import { CI_SKIP_TOKENS, findSkipTokens } from './lib/ci-skip.ts';
import { makeTempDir } from './lib/fixture.ts';
import { runCaptured } from './lib/run.ts';

void describe('findSkipTokens', () => {
  void it('finds every token regardless of case', () => {
    for (const token of CI_SKIP_TOKENS) assert.deepEqual(findSkipTokens(`feat: x\n\n${token.toUpperCase()}`), [token]);
  });

  void it('finds nothing in an ordinary message', () => {
    assert.deepEqual(findSkipTokens('feat(scope): add a skip option for the ci command'), []);
  });
});

void describe('checkCiSkipTokens', () => {
  void it('reports only the commits in the range that carry a token', () => {
    const { dir, remove } = makeTempDir('ci-skip');
    try {
      const git = (...args: readonly string[]): string => runCaptured('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.invalid', ...args], dir);
      git('init', '--quiet', '--initial-branch', 'main');
      git('commit', '--quiet', '--allow-empty', '-m', 'chore: base [skip ci]');
      git('commit', '--quiet', '--allow-empty', '-m', 'feat: clean');
      git('commit', '--quiet', '--allow-empty', '-m', 'fix: sneaky\n\nskip-checks: true');
      const problems = checkCiSkipTokens(dir, 'HEAD~2', 'HEAD').messages;
      assert.equal(problems.length, 1);
      assert.match(problems[0] ?? '', /skip-checks: true/);
    } finally {
      remove();
    }
  });
});
