import { existsSync } from 'node:fs';
import { join, posix, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { detectLayout, listPluginNames, MARKETPLACE_FILE, PLUGINS_DIR, SKILLS_DIR } from './lib/layout.ts';
import { Problems } from './lib/problems.ts';
import { reservedPluginNameReason } from './lib/reserved-names.ts';
import { runCaptured } from './lib/run.ts';
import { marketplaceSchema, pluginManifestSchema, readJson } from './lib/schemas.ts';
import { findSkillFiles, readSkillFrontmatter } from './lib/skills.ts';

export interface CheckSkillsOptions {
  /** Also run `skills add . --list` and require its listing to equal the files found here. */
  withCli: boolean;
}

/** A skill the skills CLI is expected to list: its name and the directory-relative path of its SKILL.md. */
interface FoundSkill {
  name: string;
  path: string;
  internal: boolean;
}

const ANSI_ESCAPE = /\u001b\[[0-9;?]*[A-Za-z]/g;
/** In `skills add --list` output a skill name is a box-drawing gutter plus four spaces plus the name; descriptions are indented further. */
const CLI_NAME_LINE = /^│ {4}(\S+)\s*$/;

/**
 * Checks that every skill is defined once and exposed once. In the marketplace layout the skills CLI finds a
 * plugin's skills from the marketplace entry source alone and Claude Code finds them in the plugin's `skills/`
 * directory, so a `skills` key anywhere would register the same skill twice.
 */
export function checkSkills(root: string, options: CheckSkillsOptions): Problems {
  const problems = new Problems();
  const layout = detectLayout(root);
  const skillFiles = findSkillFiles(root);

  const reachable = new Set<string>();
  if (layout === 'marketplace') checkMarketplace(root, problems, reachable);
  else for (const path of skillFiles) if (new RegExp(`^${SKILLS_DIR}/[^/]+/SKILL\\.md$`).test(path)) reachable.add(path);

  const skills: FoundSkill[] = [];
  const namePaths = new Map<string, string[]>();
  for (const path of skillFiles) {
    const frontmatter = readSkillFrontmatter(join(root, path));
    if (frontmatter.name === undefined) problems.add(`${path}: frontmatter has no name, so the skills CLI skips it`);
    if (frontmatter.description === undefined) problems.add(`${path}: frontmatter has no description`);
    const directory = posix.basename(posix.dirname(path));
    if (frontmatter.name !== undefined && frontmatter.name !== directory) {
      problems.add(`${path}: name "${frontmatter.name}" differs from its directory "${directory}"`);
    }
    if (!reachable.has(path)) {
      problems.add(`${path}: not at ${layout === 'marketplace' ? `<listed plugin>/${SKILLS_DIR}/<name>` : `${SKILLS_DIR}/<name>`}/SKILL.md, so the skills CLI cannot find it`);
    }
    if (frontmatter.name !== undefined) {
      namePaths.set(frontmatter.name, [...(namePaths.get(frontmatter.name) ?? []), path]);
      skills.push({ name: frontmatter.name, path, internal: frontmatter.metadata?.internal === true });
    }
  }
  for (const [name, paths] of namePaths) {
    if (paths.length > 1) problems.add(`skill name "${name}" is defined more than once: ${paths.join(', ')}`);
  }

  if (options.withCli) compareWithCli(root, skills, problems);
  return problems;
}

function checkMarketplace(root: string, problems: Problems, reachable: Set<string>): void {
  const marketplace = readJson(join(root, MARKETPLACE_FILE), marketplaceSchema);
  const listings = new Map<string, number>();
  const entryNames = new Set<string>();

  for (const entry of marketplace.plugins) {
    if (entryNames.has(entry.name)) problems.add(`marketplace lists "${entry.name}" more than once`);
    entryNames.add(entry.name);
    const reserved = reservedPluginNameReason(entry.name);
    if (reserved !== undefined) problems.add(`marketplace entry "${entry.name}": Claude Code reserves the name because it ${reserved}, so a third party's plugin cannot use it`);
    if ('skills' in entry) problems.add(`marketplace entry "${entry.name}" has a skills key; skills are found by their default location`);
    if ('version' in entry) problems.add(`marketplace entry "${entry.name}" has a version; the plugin's plugin.json owns it`);
    // Object sources (github, git-subdir and so on) are exposed through their own repository, never listed here.
    if (typeof entry.source !== 'string') continue;
    if (!entry.source.startsWith('./')) {
      problems.add(`marketplace entry "${entry.name}" source "${entry.source}" does not start with "./", so the skills CLI skips it`);
      continue;
    }
    const pluginDir = posix.normalize(entry.source).replace(/\/$/, '');
    listings.set(pluginDir, (listings.get(pluginDir) ?? 0) + 1);
    const manifestPath = join(root, pluginDir, '.claude-plugin', 'plugin.json');
    if (!existsSync(manifestPath)) {
      problems.add(`marketplace entry "${entry.name}" source ${entry.source} has no .claude-plugin/plugin.json`);
      continue;
    }
    const manifest = readJson(manifestPath, pluginManifestSchema);
    if (manifest.name !== entry.name) problems.add(`marketplace entry "${entry.name}" points at a plugin named "${manifest.name}"`);
  }

  for (const [pluginDir, count] of listings) {
    if (count > 1) problems.add(`${pluginDir} is listed by ${String(count)} marketplace entries, so its skills would be listed ${String(count)} times`);
    for (const path of findSkillFiles(join(root, pluginDir))) {
      if (new RegExp(`^${SKILLS_DIR}/[^/]+/SKILL\\.md$`).test(path)) reachable.add(posix.join(pluginDir, path));
    }
  }

  for (const name of listPluginNames(root)) {
    const manifestPath = join(root, PLUGINS_DIR, name, '.claude-plugin', 'plugin.json');
    if (!listings.has(`${PLUGINS_DIR}/${name}`) && existsSync(manifestPath)) problems.add(`${PLUGINS_DIR}/${name} is not listed in the marketplace`);
    if (existsSync(manifestPath) && 'skills' in readJson(manifestPath, pluginManifestSchema)) {
      problems.add(`${PLUGINS_DIR}/${name}/.claude-plugin/plugin.json has a skills key; skills are found by their default location`);
    }
  }
}

function compareWithCli(root: string, skills: readonly FoundSkill[], problems: Problems): void {
  const output = runCaptured('pnpm', ['exec', 'skills', 'add', '.', '--list'], root, { ...process.env, NO_COLOR: '1', CI: '1' });
  const listed = output
    .replace(ANSI_ESCAPE, '')
    .split('\n')
    .map((line) => CLI_NAME_LINE.exec(line)?.[1])
    .filter((name): name is string => name !== undefined);
  const counts = new Map<string, number>();
  for (const name of listed) counts.set(name, (counts.get(name) ?? 0) + 1);
  const expected = new Set(skills.filter((skill) => !skill.internal).map((skill) => skill.name));

  for (const [name, count] of counts) {
    if (count > 1) problems.add(`the skills CLI lists "${name}" ${String(count)} times`);
    if (!expected.has(name)) problems.add(`the skills CLI lists "${name}", which has no matching SKILL.md here`);
  }
  for (const name of expected) {
    if (!counts.has(name)) problems.add(`the skills CLI does not list "${name}"`);
  }
  if (listed.length === 0 && expected.size > 0) problems.add('the skills CLI output contained no skill names; its listing format may have changed');
}

if (import.meta.main) {
  const { values } = parseArgs({
    options: { root: { type: 'string', default: process.cwd() }, 'with-cli': { type: 'boolean', default: false } },
  });
  const root = resolve(values.root);
  process.exitCode = checkSkills(root, { withCli: values['with-cli'] }).report('check-skills');
}
