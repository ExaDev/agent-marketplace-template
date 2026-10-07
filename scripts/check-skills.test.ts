import assert from 'node:assert/strict';
import { after, describe, it } from 'node:test';
import { checkSkills } from './check-skills.ts';
import { makeTempDir, skillFile, writeFiles } from './lib/fixture.ts';

const GOOD_SKILL = skillFile(['name: alpha', 'description: Does alpha things.']);

/** A one-plugin marketplace whose plugin has one skill; `overrides` replace or add files. */
function marketplace(overrides: Readonly<Record<string, string | object>> = {}): string {
  const { dir, remove } = makeTempDir('check-skills');
  cleanups.push(remove);
  writeFiles(dir, {
    '.claude-plugin/marketplace.json': { name: 'm', owner: { name: 'o' }, plugins: [{ name: 'p', source: './plugins/p' }] },
    'plugins/p/.claude-plugin/plugin.json': { name: 'p', version: '0.1.0' },
    'plugins/p/skills/alpha/SKILL.md': GOOD_SKILL,
    ...overrides,
  });
  return dir;
}

const cleanups: (() => void)[] = [];
after(() => cleanups.forEach((remove) => remove()));

function problemsFor(root: string): string[] {
  return checkSkills(root, { withCli: false }).messages;
}

describe('check-skills', () => {
  it('passes a well-formed marketplace', () => {
    assert.deepEqual(problemsFor(marketplace()), []);
  });

  it('rejects a skills key in plugin.json', () => {
    const root = marketplace({ 'plugins/p/.claude-plugin/plugin.json': { name: 'p', skills: ['./skills'] } });
    assert.match(problemsFor(root).join('\n'), /plugin\.json has a skills key/);
  });

  it('rejects a skills key and a version in a marketplace entry', () => {
    const root = marketplace({
      '.claude-plugin/marketplace.json': { name: 'm', owner: { name: 'o' }, plugins: [{ name: 'p', source: './plugins/p', skills: [], version: '1.0.0' }] },
    });
    const text = problemsFor(root).join('\n');
    assert.match(text, /has a skills key/);
    assert.match(text, /has a version/);
  });

  describe('reserved plugin names', () => {
    function withPluginName(name: string): string {
      return marketplace({
        '.claude-plugin/marketplace.json': { name: 'm', owner: { name: 'o' }, plugins: [{ name, source: './plugins/p' }] },
        'plugins/p/.claude-plugin/plugin.json': { name, version: '0.1.0' },
      });
    }

    const reserved = ['claude-style', 'anthropic-tools', 'anthropics-tools', 'cc-plugin-x', 'claude', 'anthropic', 'anthropics', 'claude-code', 'claude-mods', 'official-claude', 'x-official-anthropic', 'anthropic-official', 'Claude-Style'];
    for (const name of reserved) {
      it(`rejects "${name}"`, () => assert.match(problemsFor(withPluginName(name)).join('\n'), new RegExp(`marketplace entry "${name}": Claude Code reserves the name`)));
    }

    const allowed = ['style', 'no-claude-here', 'my-claude', 'claudette', 'official', 'official-tools', 'cc-plugin', 'claudecode'];
    for (const name of allowed) {
      it(`accepts "${name}"`, () => assert.deepEqual(problemsFor(withPluginName(name)), []));
    }

    it('rejects a reserved name on a remote entry too', () => {
      const root = marketplace({
        '.claude-plugin/marketplace.json': {
          name: 'm',
          owner: { name: 'o' },
          plugins: [{ name: 'p', source: './plugins/p' }, { name: 'claude-remote', source: { source: 'github', repo: 'a/b' } }],
        },
      });
      assert.match(problemsFor(root).join('\n'), /"claude-remote": Claude Code reserves the name because it starts with "claude-"/);
    });
  });

  it('rejects a source that does not start with ./', () => {
    const root = marketplace({ '.claude-plugin/marketplace.json': { name: 'm', owner: { name: 'o' }, plugins: [{ name: 'p', source: 'plugins/p' }] } });
    assert.match(problemsFor(root).join('\n'), /does not start with "\.\/"/);
  });

  it('accepts a remote object source without listing it', () => {
    const root = marketplace({
      '.claude-plugin/marketplace.json': {
        name: 'm',
        owner: { name: 'o' },
        plugins: [{ name: 'p', source: './plugins/p' }, { name: 'remote', source: { source: 'github', repo: 'a/b' } }],
      },
    });
    assert.deepEqual(problemsFor(root), []);
  });

  it('rejects a skill without a name or description', () => {
    const root = marketplace({ 'plugins/p/skills/alpha/SKILL.md': skillFile(['description: no name']), 'plugins/p/skills/beta/SKILL.md': skillFile(['name: beta']) });
    const text = problemsFor(root).join('\n');
    assert.match(text, /alpha\/SKILL\.md: frontmatter has no name/);
    assert.match(text, /beta\/SKILL\.md: frontmatter has no description/);
  });

  it('rejects a name that differs from its directory', () => {
    const root = marketplace({ 'plugins/p/skills/alpha/SKILL.md': skillFile(['name: other', 'description: d']) });
    assert.match(problemsFor(root).join('\n'), /differs from its directory/);
  });

  it('rejects a skill name used twice across plugins', () => {
    const root = marketplace({
      '.claude-plugin/marketplace.json': { name: 'm', owner: { name: 'o' }, plugins: [{ name: 'p', source: './plugins/p' }, { name: 'q', source: './plugins/q' }] },
      'plugins/q/.claude-plugin/plugin.json': { name: 'q' },
      'plugins/q/skills/alpha/SKILL.md': GOOD_SKILL,
    });
    assert.match(problemsFor(root).join('\n'), /skill name "alpha" is defined more than once/);
  });

  it('rejects a plugin listed by two entries, which would list its skills twice', () => {
    const root = marketplace({
      '.claude-plugin/marketplace.json': { name: 'm', owner: { name: 'o' }, plugins: [{ name: 'p', source: './plugins/p' }, { name: 'p2', source: './plugins/p' }] },
    });
    assert.match(problemsFor(root).join('\n'), /listed by 2 marketplace entries/);
  });

  it('rejects a plugin directory missing from the marketplace', () => {
    const root = marketplace({ 'plugins/hidden/.claude-plugin/plugin.json': { name: 'hidden' } });
    assert.match(problemsFor(root).join('\n'), /plugins\/hidden is not listed/);
  });

  it('rejects a skill nested deeper than the skills CLI searches', () => {
    const root = marketplace({ 'plugins/p/skills/group/inner/SKILL.md': skillFile(['name: inner', 'description: d']) });
    assert.match(problemsFor(root).join('\n'), /cannot find it/);
  });

  it('checks the root skills layout', () => {
    const { dir, remove } = makeTempDir('check-skills-root');
    cleanups.push(remove);
    writeFiles(dir, { 'skills/alpha/SKILL.md': GOOD_SKILL });
    assert.deepEqual(problemsFor(dir), []);
    writeFiles(dir, { 'skills/alpha/SKILL.md': skillFile(['description: d']) });
    assert.match(problemsFor(dir).join('\n'), /no name/);
  });

  it('refuses a repository that is both layouts', () => {
    const root = marketplace({ 'skills/alpha/SKILL.md': GOOD_SKILL });
    assert.throws(() => problemsFor(root), /both/);
  });
});
