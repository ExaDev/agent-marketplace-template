import assert from 'node:assert/strict';
import { cpSync, existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { after, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { z } from 'zod';
import {
  buildScripts,
  CONTENT_MANIFEST,
  CONTENT_TYPES,
  parseContentList,
  SCRIPT_DEFINITIONS,
  selectedTypes,
  type ContentManifest,
  type SelectableContent,
} from './content.ts';
import { applyInit, isContact, TEMPLATE_NAME, type InitOptions } from './init.ts';
import { makeTempDir } from './lib/fixture.ts';
import { runInherited } from './lib/run.ts';
import { packageJsonSchema, readJson, readJsonMembers } from './lib/schemas.ts';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SKIPPED = new Set(['node_modules', '.git']);

const cleanups: (() => void)[] = [];
after(() => { cleanups.forEach((remove) => { remove(); }); });

/** A copy of this repository's files, without installed dependencies or history, to transform. */
function copyOfTemplate(): string {
  const { dir, remove } = makeTempDir('init');
  cleanups.push(remove);
  // verbatimSymlinks keeps AGENTS.md and CLAUDE.md pointing inside the copy; resolved links would make the transform rewrite this repository's own files.
  cpSync(REPO_ROOT, dir, { recursive: true, verbatimSymlinks: true, filter: (source) => !SKIPPED.has(source.split('/').pop() ?? '') });

  return dir;
}

function options(dir: string, content: readonly SelectableContent[], overrides: Partial<InitOptions> = {}): InitOptions {
  return { dir, name: 'acme-marketplace', marketplaceName: 'acme-marketplace', owner: 'Acme Ltd', org: 'acme-org', contact: 'security@acme.example', content, licence: 'MIT', examples: 'keep', year: 2031, ...overrides };
}

function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeysDeep);

  if (typeof value !== 'object' || value === null) return value;

  return Object.fromEntries(
    Object.entries(value)
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([key, member]) => [key, sortKeysDeep(member)]),
  );
}

function listFiles(root: string): Map<string, string> {
  const files = new Map<string, string>();
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      if (SKIPPED.has(entry)) continue;
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else files.set(relative(root, full), readFileSync(full, 'utf8'));
    }
  };
  walk(root);

  return files;
}

const ciWorkflowSchema = z.looseObject({
  name: z.string(),
  on: z.looseObject({}),
  jobs: z.record(z.string(), z.looseObject({ if: z.string().optional(), name: z.string().optional(), needs: z.union([z.string(), z.array(z.string())]).optional() })),
});

const mergeStepSchema = z.looseObject({
  name: z.string().optional(),
  run: z.string().optional(),
  uses: z.string().optional(),
  with: z.record(z.string(), z.union([z.string(), z.boolean()])).optional(),
});

const mergeJobSchema = z.looseObject({
  if: z.string(),
  name: z.string().optional(),
  needs: z.string().optional(),
  env: z.record(z.string(), z.string()).optional(),
  permissions: z.record(z.string(), z.string()),
  steps: z.array(mergeStepSchema),
});

const mergeWorkflowSchema = z.looseObject({
  on: z.looseObject({
    workflow_run: z.looseObject({ workflows: z.array(z.string()) }),
    pull_request_target: z.looseObject({ types: z.array(z.string()) }),
  }),
  jobs: z.looseObject({ authorise: mergeJobSchema, revoke: mergeJobSchema, merge: mergeJobSchema }),
});

function authoriseScriptAll(merge: z.infer<typeof mergeWorkflowSchema>): string {
  return merge.jobs.authorise.steps.map((step) => step.run ?? '').join('\n');
}

/**
 * The merge-when-green workflow is core content, so every content set keeps it. It must wait for a job that
 * ci really defines, aggregating `validate`, and run when that ci workflow completes.
 */
function assertMergeWorkflow(root: string, claude: boolean): void {
  const ci = ciWorkflowSchema.parse(parse(readFileSync(join(root, '.github/workflows/ci.yml'), 'utf8')));
  const mergeText = readFileSync(join(root, '.github/workflows/merge-when-green.yml'), 'utf8');
  const merge = mergeWorkflowSchema.parse(parse(mergeText));
  assert.deepEqual(merge.on.workflow_run.workflows, [ci.name], 'the merge workflow runs when ci completes');
  assert.ok(['labeled', 'synchronize', 'edited', 'reopened', 'converted_to_draft'].every((type) => merge.on.pull_request_target.types.includes(type)), 'applying the label, pushing, editing the base, reopening and converting to draft all trigger the workflow');
  assert.ok(merge.jobs.revoke.if.includes("github.event.action == 'edited' && github.event.changes.base != null"), 'a changed base removes the label');
  for (const action of ['synchronize', 'reopened', 'converted_to_draft']) assert.ok(merge.jobs.revoke.if.includes(`github.event.action == '${action}'`), `${action} removes the label`);
  assert.ok(merge.jobs.merge.if.includes("(github.event.action == 'labeled' || github.event.action == 'ready_for_review')"), 'only applying the label or leaving draft starts a merge from a pull request event');
  assert.equal(merge.jobs.authorise.name, 'authorise #${{ github.event.pull_request.number }} sha=${{ github.event.pull_request.head.sha }} by=${{ github.event.sender.login }} base=${{ github.event.pull_request.base.ref }}', 'the authorise job name records the pull request, head, person and base that verify-authorisation.sh looks for');
  assert.ok(merge.jobs.authorise.steps.some((step) => step.run?.includes('"$live_base" != "$EVENT_BASE"') === true), 'the authorisation is refused when the base moved after the label');
  assert.ok(merge.jobs.authorise.steps.some((step) => step.run?.includes('for $live_base') === true), 'the status description records the base');
  assert.ok(authoriseScriptAll(merge).includes('.default_branch') && authoriseScriptAll(merge).includes('"$live_base" != "$default_branch"'), 'the bypass token is only authorised against the default branch');
  assert.equal(merge.jobs.merge.needs, 'authorise', 'the merge waits for the authorisation job');
  assert.equal(merge.jobs.authorise.permissions.statuses, 'write', 'the authorise job records the authorisation as a commit status');
  assert.equal(merge.jobs.revoke.permissions['pull-requests'], 'write', 'the revoke job can remove the label');
  assert.ok(merge.jobs.revoke.if.includes("github.event.action == 'synchronize'"), 'the label is removed on every push');
  assert.ok(merge.jobs.authorise.steps.some((step) => step.run?.includes('.user.permissions.push') === true), 'the label authorises only when applied by someone with write access');
  assert.ok(merge.jobs.authorise.steps.some((step) => step.run?.includes('HEAD_REPO') === true), 'a fork pull request is not authorised');
  assert.equal(merge.jobs.authorise.env?.HAS_MERGE_TOKEN, "${{ secrets.MERGE_TOKEN != '' }}", 'the authorise job learns whether a bypass-capable token is configured without exposing it');
  const readerCall = 'bash .github/scripts/review-authority.sh';
  const authoriseScript = merge.jobs.authorise.steps.map((step) => step.run ?? '').join('\n');
  assert.ok(authoriseScript.includes('"$HAS_MERGE_TOKEN" = true'), 'the approval is only required when a bypass-capable token is configured');
  assert.ok(authoriseScript.includes(readerCall), 'the authorise job reads the reviews with the shared reader');
  assert.ok(authoriseScript.indexOf(readerCall) < authoriseScript.indexOf('/statuses/'), 'the approval is checked before the authorisation is recorded');
  const verifyCall = 'bash .github/scripts/verify-authorisation.sh';
  assert.ok(merge.jobs.merge.steps.some((step) => step.run?.includes(verifyCall) === true), 'the merge job verifies the authorisation with the shared script');
  const verify = readFileSync(join(root, '.github/scripts/verify-authorisation.sh'), 'utf8');
  for (const needle of ['baseRefName', '.default_branch', '"$base" = "$default_branch"', 'expected="authorise #${NUMBER} sha=${HEAD_SHA} by=${labeller} base=${base}"', 'select(.event == "labeled"', '"pull_request_target"', 'merge-when-green.yml', '/compare/', '"$HAS_MERGE_TOKEN" = true', 'review-authority.sh']) {
    assert.ok(verify.includes(needle), `the authorisation is checked against the run, base and labeller (${needle})`);
  }
  assert.ok(!verify.includes('latestOpinionatedReviews') && !authoriseScript.includes('latestOpinionatedReviews'), 'the review logic lives only in the shared reader');
  const reader = readFileSync(join(root, '.github/scripts/review-authority.sh'), 'utf8');
  for (const needle of ['.user.permissions.admin', 'latestOpinionatedReviews', 'state == "APPROVED"', '.commit.oid == $head', '.author.login != $pr.author.login', 'CHANGES_REQUESTED']) {
    assert.ok(reader.includes(needle), `the shared reader needs an independent approval of the current head or an admin (${needle})`);
  }
  const mergeSteps = merge.jobs.merge.steps;
  const verifyAt = mergeSteps.findIndex((step) => step.run?.includes('verify-authorisation.sh') === true);
  const actionAt = mergeSteps.findIndex((step) => step.uses?.startsWith('ExaDev/merge-when-green@') === true);
  assert.ok(verifyAt >= 0 && verifyAt < actionAt, 'the authorisation is verified before the action runs');
  const jobs = { authorise: merge.jobs.authorise, revoke: merge.jobs.revoke, merge: merge.jobs.merge };
  for (const [name, job] of Object.entries(jobs)) {
    assert.ok(job.if.includes('!github.event.repository.is_template'), `${name} is skipped in a repository marked as a template`);
    for (const step of job.steps) {
      if (step.uses?.startsWith('actions/checkout') === true) {
        assert.notEqual(name, 'revoke', 'revoke checks out nothing');
        assert.deepEqual(step.with, { ref: '${{ github.event.repository.default_branch }}', 'sparse-checkout': '.github/scripts', 'persist-credentials': false }, `${name} fetches only the scripts from the default branch, never the pull request`);
      }
      assert.ok(step.run?.includes('${{') !== true, `${name} reaches no shell through an expression`);
    }
  }
  const inputs = merge.jobs.merge.steps.find((candidate) => candidate.uses?.startsWith('ExaDev/merge-when-green@') === true)?.with;
  assert.ok(inputs, 'the merge step names a required check');
  const aggregates = Object.entries(ci.jobs).filter(([id, job]) => (job.name ?? id) === inputs['required-check']);
  assert.equal(aggregates.length, 1, 'the required check is exactly one job of ci');
  assert.ok([aggregates[0]?.[1].needs ?? []].flat().includes('validate'), 'the required check aggregates validate');
  assert.equal(inputs['merge-method'], 'rebase', 'pull requests are rebase merged');
  assert.ok('workflow_dispatch' in ci.on, 'ci can be dispatched, which is how a merge made with the workflow token starts it');
  assert.match(mergeText, /merge-token: \$\{\{ secrets\.MERGE_TOKEN \|\| github\.token \}\}/, 'the merge secret is an optional override of the workflow token');
  assert.match(mergeText, /HAS_MERGE_TOKEN: \$\{\{ secrets\.MERGE_TOKEN != '' \}\}/, 'the secret is tested without being exposed');
  assert.match(mergeText, /if: \$\{\{ env\.HAS_MERGE_TOKEN == 'false' && steps\.open\.outputs\.numbers != '' \}\}/, 'ci is dispatched only for a merge made with the workflow token');
  assert.ok(mergeText.includes('gh workflow run ci.yml'), 'a merge made with the workflow token dispatches ci');
  assert.match(mergeText, /^ {6}actions: write$/m, 'the merge job may dispatch ci');
  assert.match(mergeText, /^ {6}contents: write$/m, 'the merge job may merge with the workflow token');
  const releaseIf = ci.jobs.release?.if;
  assert.equal(releaseIf !== undefined, claude, 'the release job belongs to the claude content type only');
  if (releaseIf !== undefined) {
    assert.ok(releaseIf.includes('workflow_dispatch'), 'the release job accepts a dispatch');
    assert.ok(releaseIf.includes('is_template'), 'the release job stays skipped in a template repository');
    assert.ok([ci.jobs.release?.needs ?? []].flat().includes('validate'), 'the release job waits for validate');
  }
  assert.match(mergeText, /uses: ExaDev\/merge-when-green@[0-9a-f]{40} # v\d+\.\d+\.\d+\n/, 'the action is pinned by commit with a version comment');
  assert.ok(mergeText.includes('!github.event.repository.is_template'), 'a repository marked as a template never runs the merge job');
}

/** The ruleset page explains the merge secret for every content set, and the release job's part in it only where there is a release job. */
function assertMergeDocs(root: string, claude: boolean): void {
  const rulesets = readFileSync(join(root, 'docs/rulesets.md'), 'utf8');
  assert.ok(rulesets.includes('## Merging a labelled pull request'), 'the merge flow is documented');
  assert.ok(rulesets.includes('`MERGE_TOKEN` repository secret is an optional override'), 'the merge secret is documented as optional');
  assert.ok(rulesets.includes('so no secret is needed'), 'the docs do not ask for a secret');
  assert.ok(rulesets.includes('also requires, before it records the status, an approval of the current head'), 'the docs explain what the bypass token changes');
  assert.ok(rulesets.includes('reads them again just before the action runs'), 'the docs say the reviews are read again at merge time');
  assert.ok(rulesets.includes('What invalidates an authorisation: a push (new head commit), a change of the base branch'), 'the docs list what invalidates an authorisation');
  assert.ok(rulesets.includes('it only ever merges into the default branch'), 'the docs say the bypass token only merges into the default branch');
  assert.equal(rulesets.includes('The dispatched run also starts the `release` job'), claude, 'the release job paragraph belongs to the claude content type only');
  assert.ok(readFileSync(join(root, 'CONTRIBUTING.md'), 'utf8').includes('docs/rulesets.md#merging-a-labelled-pull-request'), 'CONTRIBUTING.md points at the merge flow');
}

/**
 * Independent oracle for a generated repository: hard-coded expectations, deliberately not derived from the
 * manifest, so a broken manifest rule makes it throw.
 */
function assertLayout(root: string, content: readonly SelectableContent[], marketplaceName = 'acme-marketplace'): void {
  const claude = content.includes('claude');
  const skills = content.includes('skills');
  const expectPresent = (path: string, present: boolean): void => { assert.equal(existsSync(join(root, path)), present, `${path} should ${present ? '' : 'not '}exist`); };

  expectPresent('commitlint.config.ts', true);
  expectPresent('commit-types.ts', true);
  expectPresent('eslint.config.ts', true);
  expectPresent('scripts/check-skills.ts', true);
  expectPresent('LICENSE', true);
  for (const path of ['scripts/init.ts', 'scripts/content.ts', 'scripts/init.integration.test.ts', 'scripts/init', '.github/workflows/template-selfcheck.yml']) expectPresent(path, false);

  for (const path of ['.claude-plugin/marketplace.json', 'plugins', 'plugins/example-skills/skills/word-count/SKILL.md', 'release-workspace.config.ts', 'workflow-globals.d.ts', 'scripts/sync-plugin-version.ts', 'scripts/validate-plugins.ts', 'docs/releasing.md']) {
    expectPresent(path, claude);
  }
  const ci = readFileSync(join(root, '.github/workflows/ci.yml'), 'utf8');
  assert.equal(/^ {2}release:$/m.test(ci), claude, 'the release job belongs to the claude content type only');
  assert.equal(ci.includes('content:'), false, 'no content marker may survive init');
  expectPresent('.github/workflows/merge-when-green.yml', true);
  expectPresent('.github/scripts/review-authority.sh', true);
  expectPresent('.github/scripts/verify-authorisation.sh', true);
  assertMergeWorkflow(root, claude);
  assertMergeDocs(root, claude);
  for (const path of ['skills/word-count/SKILL.md', 'skills/house-style/SKILL.md', 'shared/style-guide.md']) expectPresent(path, !claude);
  expectPresent('docs/skills-cli.md', skills);

  const pkg = readJson(join(root, 'package.json'), packageJsonSchema);
  const scripts = pkg.scripts ?? {};
  assert.equal('release' in scripts, claude, 'release script');
  assert.equal('check:versions' in scripts, claude, 'check:versions script');
  assert.equal('validate:plugins' in scripts, claude, 'validate:plugins script');
  assert.equal('init' in scripts, false, 'init script');
  assert.ok('lint' in scripts, 'lint script');
  assert.equal(scripts['check:skills']?.includes('--with-cli'), skills, 'check:skills listing check');
  assert.equal(scripts.validate?.includes('validate:plugins'), claude, 'validate runs plugin validation');
  assert.ok(scripts.validate.includes('pnpm run lint'), 'validate runs lint');
  const devDependencies = pkg.devDependencies ?? {};
  assert.equal('semantic-release' in devDependencies, claude, 'semantic-release dependency');
  assert.equal('skills' in devDependencies, skills, 'skills dependency');
  assert.ok('@exadev/eslint-config' in devDependencies, 'lint config dependency');
  assert.equal('globals' in devDependencies, claude, 'globals dependency');
  assert.equal(pkg.name, 'acme-marketplace');
  assertReadme(root, content, marketplaceName);
  if (claude) assertMarketplaceFile(root, marketplaceName);
}

/** The generated README describes the generated repository, for the chosen content set, and never the template. */
function assertReadme(root: string, content: readonly SelectableContent[], marketplaceName: string): void {
  const claude = content.includes('claude');
  const skills = content.includes('skills');
  const readme = readFileSync(join(root, 'README.md'), 'utf8');
  assert.match(readme, claude ? new RegExp(`^# ${marketplaceName}$`, 'm') : /^# acme-marketplace$/m, 'title');
  assert.ok(readme.includes('MIT, see [LICENSE](LICENSE).'), 'licence line');
  assert.ok(!readme.includes('pnpm run init'), 'the init command belongs to the template');
  assert.ok(!/scripts\/ +init/.test(readme), 'the layout line about scripts/init belongs to the template');
  assert.ok(!readme.includes('{{') && !readme.includes('content:'), 'no placeholder or marker may survive');
  assert.ok(!/template/i.test(readme), 'the README is not about a template');
  assert.equal(readme.includes('/plugin marketplace add acme-org/acme-marketplace'), claude, 'marketplace add command');
  assert.equal(readme.includes('pnpm run release'), claude, 'release command');
  assert.equal(readme.includes('.claude-plugin/marketplace.json'), claude, 'marketplace layout line');
  assert.ok(readme.includes(claude ? '`plugins/<name>/skills/<skill>/SKILL.md`' : '`skills/<skill>/SKILL.md`'), 'skills layout line');
  assert.equal(readme.includes('npx skills add acme-org/acme-marketplace'), skills, 'skills CLI install');
  assert.equal(readme.includes('docs/skills-cli.md'), skills, 'skills CLI docs link');
  const table = readme.slice(readme.indexOf('<!-- plugins:start -->'), readme.indexOf('<!-- plugins:end -->'));
  if (claude) {
    assert.ok(table.includes('| Plugin | Description | Install |'), 'plugin table header');
    assert.ok(table.includes(`\`/plugin install marketplace-maintainer@${marketplaceName}\``), 'install command uses the marketplace name');
  } else {
    assert.ok(table.includes('| Skill | Description |'), 'skill table header');
    assert.ok(table.includes('[word-count](skills/word-count/SKILL.md)'), 'skill row');
  }
}

/** marketplace.json carries the chosen name and a description that is not the template's. */
function assertMarketplaceFile(root: string, marketplaceName: string): void {
  const marketplace = JSON.parse(readFileSync(join(root, '.claude-plugin/marketplace.json'), 'utf8')) as unknown;
  assert.ok(typeof marketplace === 'object' && marketplace !== null && 'name' in marketplace && 'metadata' in marketplace);
  assert.equal(marketplace.name, marketplaceName);
  assert.deepEqual(marketplace.metadata, { description: 'Plugins and skills maintained by Acme Ltd.' });
}

void describe('--content normalisation', () => {
  const cases: readonly (readonly [string, readonly SelectableContent[]])[] = [
    ['all', ['skills', 'claude']],
    ['skills', ['skills']],
    ['claude', ['claude']],
    ['skills,claude', ['skills', 'claude']],
    ['claude,skills', ['skills', 'claude']],
    [' claude , skills ', ['skills', 'claude']],
    ['skills,skills', ['skills']],
    ['all,claude', ['skills', 'claude']],
  ];
  for (const [input, expected] of cases) {
    void it(`"${input}" becomes ${expected.join(',')}`, () => { assert.deepEqual(parseContentList(input), expected); });
  }

  for (const input of ['', '  ', ',', 'plugins', 'skills,plugins', 'skills,,claude', 'ALL']) {
    void it(`"${input}" is an error naming the valid values`, () => { assert.throws(() => parseContentList(input), /valid values: skills, claude, all/); });
  }

  void it('all selects exactly what skills,claude selects', () => {
    assert.deepEqual(parseContentList('all'), parseContentList('skills,claude'));
    assert.deepEqual(selectedTypes(parseContentList('all')), selectedTypes(parseContentList('skills,claude')));
  });
});

void describe('the content manifest', () => {
  void it('owns only paths that exist', () => {
    const paths = [...CONTENT_TYPES.flatMap((type) => CONTENT_MANIFEST.modules[type].paths), ...CONTENT_MANIFEST.templatePaths];
    for (const path of paths) assert.ok(existsSync(join(REPO_ROOT, path)), `${path} is owned by the manifest but missing`);
  });

  void it('gives every devDependency exactly one owner', () => {
    const pkg = readJson(join(REPO_ROOT, 'package.json'), packageJsonSchema);
    const owned = CONTENT_TYPES.flatMap((type) => CONTENT_MANIFEST.modules[type].devDependencies);
    assert.deepEqual([...owned].sort(), Object.keys(pkg.devDependencies ?? {}).sort());
  });

  void it('matches the scripts in package.json for the full set', () => {
    const pkg = readJson(join(REPO_ROOT, 'package.json'), packageJsonSchema);
    assert.deepEqual(pkg.scripts, buildScripts(selectedTypes(['skills', 'claude']), true));
  });

  void it('defines no script that package.json lacks', () => {
    const pkg = readJson(join(REPO_ROOT, 'package.json'), packageJsonSchema);
    assert.deepEqual(Object.keys(pkg.scripts ?? {}), Object.keys(SCRIPT_DEFINITIONS));
  });
});

void describe('applyInit', () => {
  const sets: readonly (readonly SelectableContent[])[] = [['skills'], ['claude'], ['skills', 'claude']];

  for (const content of sets) {
    void it(`produces the ${content.join(',')} layout`, () => {
      const dir = copyOfTemplate();
      applyInit(options(dir, content));
      assertLayout(dir, content);
    });
  }

  void it('gives all and skills,claude identical trees', () => {
    const first = copyOfTemplate();
    const second = copyOfTemplate();
    applyInit(options(first, parseContentList('all')));
    applyInit(options(second, parseContentList('claude,skills')));
    assert.deepEqual([...listFiles(first)], [...listFiles(second)]);
  });

  void it('keeps the plugin layout the same for claude and skills,claude apart from the skills CLI parts', () => {
    const claudeOnly = copyOfTemplate();
    const both = copyOfTemplate();
    applyInit(options(claudeOnly, ['claude']));
    applyInit(options(both, ['skills', 'claude']));
    const only = listFiles(claudeOnly);
    const all = listFiles(both);
    assert.deepEqual([...all.keys()].filter((path) => !only.has(path)), ['docs/skills-cli.md']);
    assert.deepEqual([...only.keys()].filter((path) => !all.has(path)), []);
  });

  void it('rewrites the placeholders and leaves no template name behind', () => {
    const dir = copyOfTemplate();
    applyInit(options(dir, ['skills', 'claude']));
    const marketplace = readFileSync(join(dir, '.claude-plugin/marketplace.json'), 'utf8');
    assert.match(marketplace, /"name": "acme-marketplace"/);
    assert.match(marketplace, /"name": "Acme Ltd"/);
    assert.match(readFileSync(join(dir, 'LICENSE'), 'utf8'), /Copyright \(c\) 2031 Acme Ltd/);
    for (const [path, text] of listFiles(dir)) {
      if (path === 'pnpm-lock.yaml') continue;
      assert.ok(!text.includes(TEMPLATE_NAME), `${path} still names the template`);
    }
  });

  for (const content of [['skills'], ['claude'], ['skills', 'claude']] as const) {
    void it(`leaves no template voice, placeholder or template name in the ${content.join(',')} repository`, () => {
      const dir = copyOfTemplate();
      applyInit(options(dir, content));
      for (const [path, text] of listFiles(dir)) {
        if (path === 'pnpm-lock.yaml') continue;
        assert.ok(!text.includes('generated from this template'), `${path} speaks of the template it was generated from`);
        assert.ok(!/this template/i.test(text), `${path} speaks in the template's voice`);
        assert.ok(!text.includes('PLACEHOLDER'), `${path} keeps a placeholder`);
        assert.ok(!text.includes(TEMPLATE_NAME), `${path} names the template repository`);
      }
    });
  }

  void it('writes the contact to the security policy and the code of conduct', () => {
    const dir = copyOfTemplate();
    applyInit(options(dir, ['skills'], { contact: 'https://acme.example/report' }));
    assert.ok(readFileSync(join(dir, 'SECURITY.md'), 'utf8').includes('`https://acme.example/report`'));
    assert.ok(readFileSync(join(dir, 'CODE_OF_CONDUCT.md'), 'utf8').includes('`https://acme.example/report`'));
  });

  void it('fills the repository and marketplace names into the distribution docs and leaves third-party examples alone', () => {
    const dir = copyOfTemplate();
    applyInit(options(dir, ['claude'], { marketplaceName: 'acme' }));
    const distribution = readFileSync(join(dir, 'docs/distribution.md'), 'utf8');
    assert.ok(distribution.includes('claude plugin marketplace add acme-org/acme-marketplace --scope project'));
    assert.ok(distribution.includes('"acme": {'));
    assert.ok(distribution.includes('example-skills@acme'));
    assert.ok(distribution.includes('{ "source": "github", "repo": "your-org/*" }'));
    assert.ok(!/<owner>\/<repo>|your-org\/your-marketplace|your-marketplace/.test(distribution));
    assert.ok(readFileSync(join(dir, 'docs/cross-marketplace.md'), 'utf8').includes('your-org/formatter'));
    assert.ok(readFileSync(join(dir, 'docs/rulesets.md'), 'utf8').includes('repos/acme-org/acme-marketplace/rulesets'));
  });

  void it('writes repository metadata to package.json and each plugin manifest', () => {
    const dir = copyOfTemplate();
    applyInit(options(dir, ['claude']));
    const url = 'https://github.com/acme-org/acme-marketplace';
    const pkg = readJson(join(dir, 'package.json'), packageJsonSchema);
    assert.deepEqual(pkg.repository, { type: 'git', url: `git+${url}.git` });
    assert.deepEqual(pkg.bugs, { url: `${url}/issues` });
    assert.equal(pkg.homepage, `${url}#readme`);
    const manifest = JSON.parse(readFileSync(join(dir, 'plugins/example-skills/.claude-plugin/plugin.json'), 'utf8')) as unknown;
    assert.ok(typeof manifest === 'object' && manifest !== null);
    assert.equal('repository' in manifest && manifest.repository, url);
    assert.equal('homepage' in manifest && manifest.homepage, url);
  });

  void it('writes JSON in the layout the lint config requires', () => {
    const dir = copyOfTemplate();

    applyInit(options(dir, ['claude'], { licence: 'proprietary', examples: 'none' }));
    const files = ['.claude-plugin/marketplace.json', ...readdirSync(join(dir, 'plugins')).map((name) => `plugins/${name}/.claude-plugin/plugin.json`)];

    for (const file of files) {
      const text = readFileSync(join(dir, file), 'utf8');

      assert.equal(text, `${JSON.stringify(sortKeysDeep(JSON.parse(text)), null, 2)}\n`, `${file} is not in canonical layout`);
    }

    const template = Object.keys(readJsonMembers(join(REPO_ROOT, 'package.json')));

    assert.deepEqual(Object.keys(readJsonMembers(join(dir, 'package.json'))), template, 'package.json keeps its field order');
  });

  void it('rejects a contact that is neither an email address nor an http(s) URL', () => {
    for (const contact of ['', 'security', 'ftp://acme.example', 'a b@acme.example', 'mailto:x@acme.example']) {
      assert.throws(() => { applyInit(options(copyOfTemplate(), ['skills'], { contact })); }, /--contact/, contact);
    }
  });

  void it('accepts an email address and an http(s) URL as a contact', () => {
    for (const contact of ['security@acme.example', 'http://acme.example/report', 'https://acme.example/report?x=1']) assert.ok(isContact(contact), contact);
  });

  void it('writes a proprietary notice and marks plugins unlicensed', () => {
    const dir = copyOfTemplate();
    applyInit(options(dir, ['claude'], { licence: 'proprietary' }));
    assert.match(readFileSync(join(dir, 'LICENSE'), 'utf8'), /^Copyright \(c\) 2031 Acme Ltd\. All rights reserved\./);
    assert.match(readFileSync(join(dir, 'plugins/example-skills/.claude-plugin/plugin.json'), 'utf8'), /"license": "UNLICENSED"/);
  });

  void it('removes example plugins and their entries with --examples none', () => {
    const dir = copyOfTemplate();
    applyInit(options(dir, ['claude'], { examples: 'none' }));
    assert.deepEqual(readdirSync(join(dir, 'plugins')).sort(), ['marketplace-maintainer', 'share-agent-setup']);
    const marketplace = readFileSync(join(dir, '.claude-plugin/marketplace.json'), 'utf8');
    assert.ok(!marketplace.includes('example-'));
    assert.match(marketplace, /marketplace-maintainer/);
    assert.match(marketplace, /share-agent-setup/);
  });

  void it('writes one starter skill for a skills-only repository with --examples none', () => {
    const dir = copyOfTemplate();
    applyInit(options(dir, ['skills'], { examples: 'none' }));
    assert.deepEqual(readdirSync(join(dir, 'skills')), ['starter']);
    assert.ok(!existsSync(join(dir, 'shared')));
  });

  void it('names the marketplace separately from the repository', () => {
    const dir = copyOfTemplate();
    applyInit(options(dir, ['skills', 'claude'], { marketplaceName: 'acme' }));
    assertLayout(dir, ['skills', 'claude'], 'acme');
    assert.equal(readJson(join(dir, 'package.json'), packageJsonSchema).name, 'acme-marketplace');
    const readme = readFileSync(join(dir, 'README.md'), 'utf8');
    assert.ok(readme.includes('/plugin marketplace add acme-org/acme-marketplace'), 'the repository keeps its own name');
    assert.ok(readme.includes('/plugin install <plugin>@acme\n'), 'the install command uses the marketplace name');
  });

  void it('rejects a marketplace name without the claude content type', () => {
    assert.throws(() => { applyInit(options(copyOfTemplate(), ['skills'], { marketplaceName: 'acme' })); }, /--marketplace-name needs the claude content type/);
  });

  void it('rejects a marketplace name Claude Code would not accept', () => {
    assert.throws(() => { applyInit(options(copyOfTemplate(), ['claude'], { marketplaceName: 'Not Valid' })); }, /--marketplace-name/);
  });

  void it('rejects a name Claude Code would not accept', () => {
    assert.throws(() => { applyInit(options(copyOfTemplate(), ['claude'], { name: 'Not Valid' })); }, /--name/);
  });

  void describe('mutation check: breaking an owned-path rule fails the layout oracle', () => {
    function mutated(type: 'claude' | 'skills', removed: string): ContentManifest {
      const module = CONTENT_MANIFEST.modules[type];

      return { ...CONTENT_MANIFEST, modules: { ...CONTENT_MANIFEST.modules, [type]: { ...module, paths: module.paths.filter((path) => path !== removed) } } };
    }

    void it('detects plugins/ left behind in a skills-only repository', () => {
      const dir = copyOfTemplate();
      applyInit(options(dir, ['skills']), mutated('claude', 'plugins'));
      assert.throws(() => { assertLayout(dir, ['skills']); }, /plugins should not exist/);
    });

    void it('detects the skills CLI docs left behind in a claude-only repository', () => {
      const dir = copyOfTemplate();
      applyInit(options(dir, ['claude']), mutated('skills', 'docs/skills-cli.md'));
      assert.throws(() => { assertLayout(dir, ['claude']); }, /docs\/skills-cli\.md should not exist/);
    });

    void it('detects the template README left in place', () => {
      assert.throws(() => { assertReadme(REPO_ROOT, ['skills', 'claude'], 'acme-marketplace'); });
    });

    void it('passes the same oracle with the real manifest', () => {
      const dir = copyOfTemplate();
      applyInit(options(dir, ['skills']));
      assert.doesNotThrow(() => { assertLayout(dir, ['skills']); });
    });
  });
});

void describe('a generated repository validates itself', () => {
  const sets: readonly (readonly SelectableContent[])[] = [['skills'], ['claude'], ['skills', 'claude']];
  for (const content of sets) {
    void it(`installs and passes validate for ${content.join(',')}`, { timeout: 600_000 }, () => {
      const dir = copyOfTemplate();
      applyInit(options(dir, content));
      runInherited('pnpm', ['install', '--no-frozen-lockfile'], dir);
      runInherited('pnpm', ['run', 'validate'], dir);
    });
  }
});
