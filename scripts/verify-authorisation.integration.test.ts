import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { makeTempDir, writeFiles } from './lib/fixture.ts';

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), '..', '.github', 'scripts', 'verify-authorisation.sh');
/** Owner read, write and execute, and read and execute for everyone else: what `bash` needs to run the fake `gh` found on PATH. */
const EXECUTABLE = 0o755;
const HEAD = 'head-sha';
const RUN = '4242';
const WORKFLOW_PATH = '.github/workflows/merge-when-green.yml';
/** The base branch commit GitHub records in a pull_request_target run's pull_requests list, which is where the workflow file was read from. */
const BASE_SHA = 'workflow-sha';

interface Scenario {
  readonly liveHead?: string;
  readonly base?: string;
  readonly labellers?: readonly string[];
  readonly statusUrl?: string;
  readonly run?: { readonly event: string; readonly path: string };
  readonly relation?: string;
  readonly pullRequests?: readonly { readonly number: number; readonly head: { readonly sha: string }; readonly base: { readonly sha: string } }[];
  readonly jobName?: string;
  readonly jobConclusion?: string;
  readonly readOnly?: readonly string[];
}

/** A `gh` that answers every call the script makes from a scenario file, whatever flags it passes. */
const FAKE_GH = `#!/usr/bin/env bash
target=""
for arg in "$@"; do case "$arg" in repos/*) target="$arg" ;; esac; done
case "$1 $2" in
  "pr view") jq -c .pr "$SCENARIO" ;;
  *)
    case "$target" in
      */timeline) jq -c '[.timeline]' "$SCENARIO" ;;
      */statuses*) jq -c .statuses "$SCENARIO" ;;
      */actions/runs/*/jobs*) id=\${target#*/actions/runs/}; id=\${id%%/*}; jq -c --arg id "$id" '.jobs[$id]' "$SCENARIO" ;;
      */actions/runs/*) id=\${target#*/actions/runs/}; jq -c --arg id "$id" '.runs[$id]' "$SCENARIO" ;;
      */compare/*) spec=\${target#*/compare/}; jq -c --arg sha "\${spec%%...*}" '{status: .compare[$sha]}' "$SCENARIO" ;;
      */collaborators/*/permission*) login=\${target#*/collaborators/}; login=\${login%%/permission*}
        case " $READ_ONLY " in *" $login "*) push=false ;; *) push=true ;; esac
        echo "{\\"user\\":{\\"permissions\\":{\\"push\\":$push}}}" ;;
      *) echo "unexpected gh call: $*" >&2; exit 99 ;;
    esac ;;
esac
`;

function verify(scenario: Scenario): { readonly status: number | null; readonly stdout: string } {
  const { dir, remove } = makeTempDir('verify-authorisation');
  try {
    const base = scenario.base ?? 'main';
    const labeller = (scenario.labellers ?? ['maintainer']).at(-1) ?? '';
    const data = {
      pr: { headRefOid: scenario.liveHead ?? HEAD, baseRefName: base },
      timeline: [{ event: 'commented' }, ...(scenario.labellers ?? ['maintainer']).map((login) => ({ event: 'labeled', label: { name: 'automerge' }, actor: { login } }))],
      statuses: [{ context: 'merge-when-green/authorised', state: 'success', target_url: scenario.statusUrl ?? `https://github.com/owner/repo/actions/runs/${RUN}` }],
      // A real pull_request_target run reports the pull request's head commit as its own head_sha and the base commit only inside pull_requests.
      runs: {
        [RUN]: {
          ...(scenario.run ?? { event: 'pull_request_target', path: WORKFLOW_PATH }),
          head_sha: HEAD,
          pull_requests: scenario.pullRequests ?? [{ number: 7, head: { sha: HEAD }, base: { sha: BASE_SHA } }],
        },
      },
      compare: { [BASE_SHA]: scenario.relation ?? 'ahead' },
      jobs: { [RUN]: { jobs: [{ name: scenario.jobName ?? `authorise #7 sha=${HEAD} by=${labeller} base=${base}`, conclusion: scenario.jobConclusion ?? 'success' }] } },
    };
    writeFiles(dir, { 'bin/gh': FAKE_GH, 'scenario.json': data });
    chmodSync(join(dir, 'bin', 'gh'), EXECUTABLE);
    const result = spawnSync('bash', [SCRIPT], {
      encoding: 'utf8',
      env: {
        PATH: `${join(dir, 'bin')}:${process.env.PATH ?? ''}`,
        SCENARIO: join(dir, 'scenario.json'),
        READ_ONLY: (scenario.readOnly ?? []).join(' '),
        GITHUB_REPOSITORY: 'owner/repo',
        NUMBER: '7',
        HEAD_SHA: HEAD,
        LABEL: 'automerge',
        AUTHORISED_CONTEXT: 'merge-when-green/authorised',
      },
    });

    return { status: result.status, stdout: result.stdout };
  } finally {
    remove();
  }
}

void describe('verify-authorisation.sh', () => {
  void it('accepts a head, base and labeller that a merge-when-green run authorised', () => {
    assert.equal(verify({}).status, 0);
  });

  void it('accepts a base other than the default branch when the run names it', () => {
    assert.equal(verify({ base: 'release/1' }).status, 0);
  });

  void it('refuses once the base changed after the label, because the run names the old base', () => {
    const { status, stdout } = verify({ base: 'main', jobName: `authorise #7 sha=${HEAD} by=maintainer base=feature` });
    assert.equal(status, 1);
    assert.match(stdout, /::error::/);
  });

  void it('refuses when someone other than the authorised person applied the label last', () => {
    assert.equal(verify({ labellers: ['maintainer', 'author'], jobName: `authorise #7 sha=${HEAD} by=maintainer base=main` }).status, 1);
  });

  void it('refuses a status that points at a run of another workflow', () => {
    assert.equal(verify({ run: { event: 'pull_request', path: '.github/workflows/ci.yml' } }).status, 1);
  });

  void it('refuses a pull_request_target run whose workflow is not in the base branch history', () => {
    assert.equal(verify({ relation: 'diverged' }).status, 1);
  });

  void it('refuses a run that is not recorded against this pull request and head', () => {
    assert.equal(verify({ pullRequests: [{ number: 8, head: { sha: HEAD }, base: { sha: BASE_SHA } }] }).status, 1);
    assert.equal(verify({ pullRequests: [{ number: 7, head: { sha: 'other-sha' }, base: { sha: BASE_SHA } }] }).status, 1);
    assert.equal(verify({ pullRequests: [] }).status, 1);
  });

  void it('refuses when the person who applied the label no longer has write access', () => {
    assert.equal(verify({ readOnly: ['maintainer'] }).status, 1);
  });

  void it('refuses a run whose authorise job did not succeed', () => {
    assert.equal(verify({ jobConclusion: 'failure' }).status, 1);
  });

  void it('refuses a status without a run link', () => {
    assert.equal(verify({ statusUrl: 'https://example.com/elsewhere' }).status, 1);
  });

  void it('leaves a pull request that moved on to its own run', () => {
    const { status, stdout } = verify({ liveHead: 'newer-sha' });
    assert.equal(status, 0);
    assert.match(stdout, /moved on/);
  });

});
