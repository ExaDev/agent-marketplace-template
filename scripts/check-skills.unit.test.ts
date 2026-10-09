import assert from 'node:assert/strict';
import { after, describe, it } from 'node:test';
import { checkSkills } from './check-skills.ts';
import { makeTempDir, skillFile, writeFiles } from './lib/fixture.ts';

const GOOD_SKILL = skillFile(['name: alpha', 'description: Does alpha things.']);

const cleanups: (() => void)[] = [];

after(() => {
  for (const remove of cleanups) remove();
});

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

function problemsFor(root: string): string[] {
  return checkSkills(root, { withCli: false }).messages;
}

void describe('check-skills', () => {
  void it('passes a well-formed marketplace', () => {
    assert.deepEqual(problemsFor(marketplace()), []);
  });

void describe('reserved plugin names', () => {
    function withPluginName(name: string): string {
      return marketplace({
        '.claude-plugin/marketplace.json': { name: 'm', owner: { name: 'o' }, plugins: [{ name, source: './plugins/p' }] },
        'plugins/p/.claude-plugin/plugin.json': { name, version: '0.1.0' },
      });
    }

    const reserved = ['claude-style', 'anthropic-tools', 'anthropics-tools', 'cc-plugin-x', 'claude', 'anthropic', 'anthropics', 'claude-code', 'claude-mods', 'official-claude', 'x-official-anthropic', 'anthropic-official', 'Claude-Style'];
    for (const name of reserved) {
      void it(`rejects "${name}"`, () => { assert.match(problemsFor(withPluginName(name)).join('\n'), new RegExp(`marketplace entry "${name}": Claude Code reserves the name`)); });
    }

    const allowed = ['style', 'no-claude-here', 'my-claude', 'claudette', 'official', 'official-tools', 'cc-plugin', 'claudecode'];
    for (const name of allowed) {
      void it(`accepts "${name}"`, () => { assert.deepEqual(problemsFor(withPluginName(name)), []); });
    }

    void it('rejects a reserved name on a remote entry too', () => {
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

  void it('accepts a remote object source without listing it', () => {
    const root = marketplace({
      '.claude-plugin/marketplace.json': {
        name: 'm',
        owner: { name: 'o' },
        plugins: [{ name: 'p', source: './plugins/p' }, { name: 'remote', source: { source: 'github', repo: 'a/b' } }],
      },
    });

    assert.deepEqual(problemsFor(root), []);
  });

  void it('reports the skills of a plugin whose source does not start with ./, which the skills CLI skips', () => {
    const root = marketplace({ '.claude-plugin/marketplace.json': { name: 'm', owner: { name: 'o' }, plugins: [{ name: 'p', source: 'plugins/p' }] } });

    assert.match(problemsFor(root).join('\n'), /plugins\/p\/skills\/alpha\/SKILL\.md: not at <listed plugin>\/skills\/<name>\/SKILL\.md/);
  });

  void it('reports the skills of a plugin directory the marketplace does not list', () => {
    const root = marketplace({
      'plugins/hidden/.claude-plugin/plugin.json': { name: 'hidden' },
      'plugins/hidden/skills/beta/SKILL.md': skillFile(['name: beta', 'description: d']),
    });

    assert.match(problemsFor(root).join('\n'), /plugins\/hidden\/skills\/beta\/SKILL\.md: not at/);
  });

  void it('reports a skill nested deeper than the skills CLI searches', () => {
    const root = marketplace({ 'plugins/p/skills/group/inner/SKILL.md': skillFile(['name: inner', 'description: d']) });

    assert.match(problemsFor(root).join('\n'), /cannot find it/);
  });

  void it('checks the root skills layout', () => {
    const { dir, remove } = makeTempDir('check-skills-root');

    cleanups.push(remove);
    writeFiles(dir, { 'skills/alpha/SKILL.md': GOOD_SKILL });
    assert.deepEqual(problemsFor(dir), []);
    writeFiles(dir, { 'skills/group/inner/SKILL.md': skillFile(['name: inner', 'description: d']) });
    assert.match(problemsFor(dir).join('\n'), /skills\/group\/inner\/SKILL\.md: not at skills\/<name>\/SKILL\.md/);
  });

  void it('refuses a repository that is both layouts', () => {
    const root = marketplace({ 'skills/alpha/SKILL.md': GOOD_SKILL });

    assert.throws(() => problemsFor(root), /both/);
  });
});
