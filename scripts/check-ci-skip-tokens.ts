import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { findSkipTokens } from './lib/ci-skip.ts';
import { Problems } from './lib/problems.ts';
import { runCaptured } from './lib/run.ts';

/** Separates commit bodies in `git log` output; a NUL cannot occur in a commit message. */
const RECORD_SEPARATOR = '\u0000';

/** Checks every commit in `from..to` of the repository at `root`. */
export function checkCiSkipTokens(root: string, from: string, to: string): Problems {
  const problems = new Problems();
  const log = runCaptured('git', ['log', '--format=%h%n%B%x00', `${from}..${to}`], root);
  for (const record of log.split(RECORD_SEPARATOR)) {
    const trimmed = record.trim();
    if (trimmed === '') continue;
    const [sha, ...body] = trimmed.split('\n');
    for (const token of findSkipTokens(body.join('\n'))) {
      problems.add(`commit ${sha ?? ''} contains "${token}", which would skip CI`);
    }
  }

  return problems;
}

if (import.meta.main) {
  const { values } = parseArgs({
    options: {
      root: { type: 'string', default: process.cwd() },
      from: { type: 'string' },
      to: { type: 'string', default: 'HEAD' },
    },
  });
  if (values.from === undefined) throw new Error('--from <ref> is required, for example --from origin/main');
  process.exitCode = checkCiSkipTokens(resolve(values.root), values.from, values.to).report('check-ci-skip');
}
