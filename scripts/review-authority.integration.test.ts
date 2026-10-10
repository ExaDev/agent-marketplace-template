import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { makeTempDir, writeFiles } from './lib/fixture.ts';

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), '..', '.github', 'scripts', 'review-authority.sh');
const HEAD = 'head-sha';
/** Owner read, write and execute, and read and execute for everyone else: what `bash` needs to run the fake `gh` found on PATH. */
const EXECUTABLE = 0o755;

interface Review {
  readonly state: 'APPROVED' | 'CHANGES_REQUESTED';
  readonly reviewer: string;
  readonly commit: string;
}

/** A `gh` that answers the script's two calls from the environment: permissions by login, and the pull request's reviews. */
const FAKE_GH = `#!/usr/bin/env bash
case "$*" in
  *collaborators/*/permission*)
    login=\${2#*collaborators/}
    login=\${login%%/permission*}
    case " $WRITERS " in *" $login "*) push=true ;; *) push=false ;; esac
    case " $ADMINS " in *" $login "*) admin=true ;; *) admin=false ;; esac
    if [[ "$*" == *--jq* ]]; then echo "$push"; else echo "{\\"user\\":{\\"permissions\\":{\\"admin\\":$admin,\\"push\\":$push}}}"; fi
    ;;
  *graphql*) echo "$REVIEWS" ;;
  *) echo "unexpected gh call: $*" >&2; exit 99 ;;
esac
`;

function decide(scenario: { readonly labeller: string; readonly admins?: readonly string[]; readonly writers: readonly string[]; readonly reviews: readonly Review[] }): { readonly status: number | null; readonly stdout: string } {
  const { dir, remove } = makeTempDir('review-authority');
  try {
    writeFiles(dir, { 'bin/gh': FAKE_GH });
    chmodSync(join(dir, 'bin', 'gh'), EXECUTABLE);
    const nodes = scenario.reviews.map((review) => ({ state: review.state, author: { login: review.reviewer }, commit: { oid: review.commit } }));
    const reviews = JSON.stringify({ data: { repository: { pullRequest: { author: { login: 'author' }, latestOpinionatedReviews: { nodes } } } } });
    const result = spawnSync('bash', [SCRIPT], {
      encoding: 'utf8',
      env: {
        PATH: `${join(dir, 'bin')}:${process.env.PATH ?? ''}`,
        GITHUB_REPOSITORY: 'owner/repo',
        NUMBER: '1',
        HEAD_SHA: HEAD,
        LABELLER: scenario.labeller,
        ADMINS: (scenario.admins ?? []).join(' '),
        WRITERS: scenario.writers.join(' '),
        REVIEWS: reviews,
      },
    });

    return { status: result.status, stdout: result.stdout };
  } finally {
    remove();
  }
}

void describe('review-authority.sh', () => {
  void it('accepts an admin labeller without any review', () => {
    assert.equal(decide({ labeller: 'root', admins: ['root'], writers: ['root'], reviews: [] }).status, 0);
  });

  void it('accepts a writer labeller when another writer approved the current head', () => {
    assert.equal(decide({ labeller: 'author', writers: ['author', 'peer'], reviews: [{ state: 'APPROVED', reviewer: 'peer', commit: HEAD }] }).status, 0);
  });

  void it('refuses a writer labeller when nobody approved', () => {
    const { status, stdout } = decide({ labeller: 'author', writers: ['author'], reviews: [] });
    assert.equal(status, 1);
    assert.match(stdout, /::error::/);
  });

  void it('refuses once any reviewer requests changes after the approval', () => {
    const reviews: readonly Review[] = [
      { state: 'APPROVED', reviewer: 'peer', commit: HEAD },
      { state: 'CHANGES_REQUESTED', reviewer: 'other', commit: HEAD },
    ];
    assert.equal(decide({ labeller: 'author', writers: ['author', 'peer', 'other'], reviews }).status, 1);
  });

  void it('does not count the author, an approver without write access or an approval of an earlier head', () => {
    for (const review of [
      { state: 'APPROVED', reviewer: 'author', commit: HEAD },
      { state: 'APPROVED', reviewer: 'visitor', commit: HEAD },
      { state: 'APPROVED', reviewer: 'peer', commit: 'earlier-sha' },
    ] as const) {
      assert.equal(decide({ labeller: 'author', writers: ['author', 'peer'], reviews: [review] }).status, 1, `${review.reviewer} on ${review.commit}`);
    }
  });
});
