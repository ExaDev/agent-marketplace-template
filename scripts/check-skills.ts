import { join, posix, resolve } from 'node:path';
import { parseArgs, stripVTControlCharacters } from 'node:util';
import { detectLayout, MARKETPLACE_FILE, SKILLS_DIR } from './lib/layout.ts';
import { Problems } from './lib/problems.ts';
import { reservedPluginNameReason } from './lib/reserved-names.ts';
import { runCaptured } from './lib/run.ts';
import { marketplaceSchema, readJson } from './lib/schemas.ts';
import { findSkillFiles, readSkillFrontmatter } from './lib/skills.ts';

export interface CheckSkillsOptions {
  /** Also run `skills add . --list` and require its listing to equal the files found here. */
  withCli: boolean;
}

/** A skill the skills CLI is expected to list: its name, and whether it is marked internal so the CLI hides it. */
interface FoundSkill {
  name: string;
  internal: boolean;
}

/** In `skills add --list` output a skill name is a box-drawing gutter plus four spaces plus the name; descriptions are indented further. */
const CLI_NAME_LINE = /^│ {4}(\S+)\s*$/;

/**
 * Checks that every skill is where the skills CLI finds it, that no marketplace entry uses a name Claude Code
 * reserves, and that the CLI lists exactly the skills defined here. The structural rules about names,
 * frontmatter, manifests and marketplace entries are ESLint rules (`exadev/skill-frontmatter`,
 * `exadev/skill-name-unique`, `exadev/marketplace-manifest` and `exadev/plugin-manifest`), so they are not
 * repeated here.
 */
export function checkSkills(root: string, options: Readonly<CheckSkillsOptions>): Problems {
  const problems = new Problems();
  const layout = detectLayout(root);
  const skillFiles = findSkillFiles(root);
  const reachable = layout === 'marketplace' ? listedSkillFiles(root) : rootSkillFiles(skillFiles);
  const skills: FoundSkill[] = [];

  if (layout === 'marketplace') checkReservedNames(root, problems);

  for (const path of skillFiles) {
    if (!reachable.has(path)) {
      problems.add(`${path}: not at ${layout === 'marketplace' ? `<listed plugin>/${SKILLS_DIR}/<name>` : `${SKILLS_DIR}/<name>`}/SKILL.md, so the skills CLI cannot find it`);
    }

    const frontmatter = readSkillFrontmatter(join(root, path));

    if (frontmatter.name !== undefined) skills.push({ name: frontmatter.name, internal: frontmatter.metadata?.internal === true });
  }

  if (options.withCli) compareWithCli(root, skills, problems);

  return problems;
}

/** Claude Code refuses a third-party plugin whose name passes as one of Anthropic's own; `claude plugin validate` reports it only on versions that know the rule, so it is checked here too. Remote entries count. */
function checkReservedNames(root: string, problems: Problems): void {
  for (const entry of readJson(join(root, MARKETPLACE_FILE), marketplaceSchema).plugins) {
    const reserved = reservedPluginNameReason(entry.name);

    if (reserved !== undefined) problems.add(`marketplace entry "${entry.name}": Claude Code reserves the name because it ${reserved}, so a third party's plugin cannot use it`);
  }
}

const SKILL_FILE_AT_DEFAULT_DEPTH = new RegExp(`^${SKILLS_DIR}/[^/]+/SKILL\\.md$`);

/** The SKILL.md files, relative to `root`, that sit at `skills/<name>/SKILL.md`. */
function rootSkillFiles(skillFiles: readonly string[]): Set<string> {
  return new Set(skillFiles.filter((path) => SKILL_FILE_AT_DEFAULT_DEPTH.test(path)));
}

/**
 * The SKILL.md files, relative to `root`, at `<plugin>/skills/<name>/SKILL.md` for every plugin a marketplace
 * entry lists by a relative source. Object sources (github, git-subdir and so on) are exposed through their own
 * repository, never listed here.
 */
function listedSkillFiles(root: string): Set<string> {
  const marketplace = readJson(join(root, MARKETPLACE_FILE), marketplaceSchema);
  const reachable = new Set<string>();

  for (const entry of marketplace.plugins) {
    if (typeof entry.source !== 'string' || !entry.source.startsWith('./')) continue;

    const pluginDir = posix.normalize(entry.source).replace(/\/$/, '');

    for (const path of rootSkillFiles(findSkillFiles(join(root, pluginDir)))) reachable.add(posix.join(pluginDir, path));
  }

  return reachable;
}

function compareWithCli(root: string, skills: readonly FoundSkill[], problems: Problems): void {
  const output = runCaptured('pnpm', ['exec', 'skills', 'add', '.', '--list'], root, { ...process.env, NO_COLOR: '1', CI: '1' });
  const listed = stripVTControlCharacters(output)
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
