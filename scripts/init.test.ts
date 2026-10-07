import assert from 'node:assert/strict';
import { cpSync, existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { after, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
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
import { applyInit, TEMPLATE_NAME, type InitOptions } from './init.ts';
import { makeTempDir } from './lib/fixture.ts';
import { runInherited } from './lib/run.ts';
import { packageJsonSchema, readJson } from './lib/schemas.ts';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SKIPPED = new Set(['node_modules', '.git']);

const cleanups: (() => void)[] = [];
after(() => cleanups.forEach((remove) => remove()));

/** A copy of this repository's files, without installed dependencies or history, to transform. */
function copyOfTemplate(): string {
  const { dir, remove } = makeTempDir('init');
  cleanups.push(remove);
  // verbatimSymlinks keeps AGENTS.md and CLAUDE.md pointing inside the copy; resolved links would make the transform rewrite this repository's own files.
  cpSync(REPO_ROOT, dir, { recursive: true, verbatimSymlinks: true, filter: (source) => !SKIPPED.has(source.split('/').pop() ?? '') });
  return dir;
}

function options(dir: string, content: readonly SelectableContent[], overrides: Partial<InitOptions> = {}): InitOptions {
  return { dir, name: 'acme-marketplace', owner: 'Acme Ltd', org: 'acme-org', content, licence: 'MIT', examples: 'keep', year: 2031, ...overrides };
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

/**
 * Independent oracle for a generated repository: hard-coded expectations, deliberately not derived from the
 * manifest, so a broken manifest rule makes it throw.
 */
function assertLayout(root: string, content: readonly SelectableContent[]): void {
  const claude = content.includes('claude');
  const skills = content.includes('skills');
  const expectPresent = (path: string, present: boolean): void => assert.equal(existsSync(join(root, path)), present, `${path} should ${present ? '' : 'not '}exist`);

  expectPresent('commitlint.config.ts', true);
  expectPresent('commit-types.ts', true);
  expectPresent('scripts/check-skills.ts', true);
  expectPresent('LICENSE', true);
  for (const path of ['scripts/init.ts', 'scripts/content.ts', 'scripts/init.test.ts', 'scripts/init', '.github/workflows/template-selfcheck.yml']) expectPresent(path, false);

  for (const path of ['.claude-plugin/marketplace.json', 'plugins', 'plugins/example-skills/skills/word-count/SKILL.md', 'release-workspace.config.ts', 'scripts/sync-plugin-version.ts', 'scripts/validate-plugins.ts', '.github/workflows/release.yml', 'docs/releasing.md']) {
    expectPresent(path, claude);
  }
  for (const path of ['skills/word-count/SKILL.md', 'skills/house-style/SKILL.md', 'shared/style-guide.md']) expectPresent(path, !claude);
  expectPresent('docs/skills-cli.md', skills);

  const pkg = readJson(join(root, 'package.json'), packageJsonSchema);
  const scripts = pkg.scripts ?? {};
  assert.equal('release' in scripts, claude, 'release script');
  assert.equal('check:versions' in scripts, claude, 'check:versions script');
  assert.equal('validate:plugins' in scripts, claude, 'validate:plugins script');
  assert.equal('init' in scripts, false, 'init script');
  assert.equal(scripts['check:skills']?.includes('--with-cli'), skills, 'check:skills listing check');
  assert.equal(scripts.validate?.includes('validate:plugins'), claude, 'validate runs plugin validation');
  const devDependencies = pkg.devDependencies ?? {};
  assert.equal('semantic-release' in devDependencies, claude, 'semantic-release dependency');
  assert.equal('skills' in devDependencies, skills, 'skills dependency');
  assert.equal(pkg.name, 'acme-marketplace');
}

describe('--content normalisation', () => {
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
    it(`"${input}" becomes ${expected.join(',')}`, () => assert.deepEqual(parseContentList(input), expected));
  }

  for (const input of ['', '  ', ',', 'plugins', 'skills,plugins', 'skills,,claude', 'ALL']) {
    it(`"${input}" is an error naming the valid values`, () => assert.throws(() => parseContentList(input), /valid values: skills, claude, all/));
  }

  it('all selects exactly what skills,claude selects', () => {
    assert.deepEqual(parseContentList('all'), parseContentList('skills,claude'));
    assert.deepEqual(selectedTypes(parseContentList('all')), selectedTypes(parseContentList('skills,claude')));
  });
});

describe('the content manifest', () => {
  it('owns only paths that exist', () => {
    const paths = [...CONTENT_TYPES.flatMap((type) => CONTENT_MANIFEST.modules[type].paths), ...CONTENT_MANIFEST.templatePaths];
    for (const path of paths) assert.ok(existsSync(join(REPO_ROOT, path)), `${path} is owned by the manifest but missing`);
  });

  it('gives every devDependency exactly one owner', () => {
    const pkg = readJson(join(REPO_ROOT, 'package.json'), packageJsonSchema);
    const owned = CONTENT_TYPES.flatMap((type) => CONTENT_MANIFEST.modules[type].devDependencies);
    assert.deepEqual([...owned].sort(), Object.keys(pkg.devDependencies ?? {}).sort());
  });

  it('matches the scripts in package.json for the full set', () => {
    const pkg = readJson(join(REPO_ROOT, 'package.json'), packageJsonSchema);
    assert.deepEqual(pkg.scripts, buildScripts(selectedTypes(['skills', 'claude']), true));
  });

  it('defines no script that package.json lacks', () => {
    const pkg = readJson(join(REPO_ROOT, 'package.json'), packageJsonSchema);
    assert.deepEqual(Object.keys(pkg.scripts ?? {}), Object.keys(SCRIPT_DEFINITIONS));
  });
});

describe('applyInit', () => {
  const sets: readonly (readonly SelectableContent[])[] = [['skills'], ['claude'], ['skills', 'claude']];

  for (const content of sets) {
    it(`produces the ${content.join(',')} layout`, () => {
      const dir = copyOfTemplate();
      applyInit(options(dir, content));
      assertLayout(dir, content);
    });
  }

  it('gives all and skills,claude identical trees', () => {
    const first = copyOfTemplate();
    const second = copyOfTemplate();
    applyInit(options(first, parseContentList('all')));
    applyInit(options(second, parseContentList('claude,skills')));
    assert.deepEqual([...listFiles(first)], [...listFiles(second)]);
  });

  it('keeps the plugin layout the same for claude and skills,claude apart from the skills CLI parts', () => {
    const claudeOnly = copyOfTemplate();
    const both = copyOfTemplate();
    applyInit(options(claudeOnly, ['claude']));
    applyInit(options(both, ['skills', 'claude']));
    const only = listFiles(claudeOnly);
    const all = listFiles(both);
    assert.deepEqual([...all.keys()].filter((path) => !only.has(path)), ['docs/skills-cli.md']);
    assert.deepEqual([...only.keys()].filter((path) => !all.has(path)), []);
  });

  it('rewrites the placeholders and leaves no template name behind', () => {
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

  it('writes a proprietary notice and marks plugins unlicensed', () => {
    const dir = copyOfTemplate();
    applyInit(options(dir, ['claude'], { licence: 'proprietary' }));
    assert.match(readFileSync(join(dir, 'LICENSE'), 'utf8'), /^Copyright \(c\) 2031 Acme Ltd\. All rights reserved\./);
    assert.match(readFileSync(join(dir, 'plugins/example-skills/.claude-plugin/plugin.json'), 'utf8'), /"license": "UNLICENSED"/);
  });

  it('removes example plugins and their entries with --examples none', () => {
    const dir = copyOfTemplate();
    applyInit(options(dir, ['claude'], { examples: 'none' }));
    assert.deepEqual(readdirSync(join(dir, 'plugins')), ['marketplace-maintainer']);
    const marketplace = readFileSync(join(dir, '.claude-plugin/marketplace.json'), 'utf8');
    assert.ok(!marketplace.includes('example-'));
    assert.match(marketplace, /marketplace-maintainer/);
  });

  it('writes one starter skill for a skills-only repository with --examples none', () => {
    const dir = copyOfTemplate();
    applyInit(options(dir, ['skills'], { examples: 'none' }));
    assert.deepEqual(readdirSync(join(dir, 'skills')), ['starter']);
    assert.ok(!existsSync(join(dir, 'shared')));
  });

  it('rejects a name Claude Code would not accept', () => {
    assert.throws(() => applyInit(options(copyOfTemplate(), ['claude'], { name: 'Not Valid' })), /--name/);
  });

  describe('mutation check: breaking an owned-path rule fails the layout oracle', () => {
    function mutated(type: 'claude' | 'skills', removed: string): ContentManifest {
      const module = CONTENT_MANIFEST.modules[type];
      return { ...CONTENT_MANIFEST, modules: { ...CONTENT_MANIFEST.modules, [type]: { ...module, paths: module.paths.filter((path) => path !== removed) } } };
    }

    it('detects plugins/ left behind in a skills-only repository', () => {
      const dir = copyOfTemplate();
      applyInit(options(dir, ['skills']), mutated('claude', 'plugins'));
      assert.throws(() => assertLayout(dir, ['skills']), /plugins should not exist/);
    });

    it('detects the skills CLI docs left behind in a claude-only repository', () => {
      const dir = copyOfTemplate();
      applyInit(options(dir, ['claude']), mutated('skills', 'docs/skills-cli.md'));
      assert.throws(() => assertLayout(dir, ['claude']), /docs\/skills-cli\.md should not exist/);
    });

    it('passes the same oracle with the real manifest', () => {
      const dir = copyOfTemplate();
      applyInit(options(dir, ['skills']));
      assert.doesNotThrow(() => assertLayout(dir, ['skills']));
    });
  });
});

describe('a generated repository validates itself', () => {
  const sets: readonly (readonly SelectableContent[])[] = [['skills'], ['claude'], ['skills', 'claude']];
  for (const content of sets) {
    it(`installs and passes validate for ${content.join(',')}`, { timeout: 600_000 }, () => {
      const dir = copyOfTemplate();
      applyInit(options(dir, content));
      runInherited('pnpm', ['install', '--no-frozen-lockfile'], dir);
      runInherited('pnpm', ['run', 'validate'], dir);
    });
  }
});
