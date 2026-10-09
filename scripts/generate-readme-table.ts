import { readFileSync, writeFileSync } from 'node:fs';
import { join, posix, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { detectLayout, MARKETPLACE_FILE, SKILLS_DIR } from './lib/layout.ts';
import { marketplaceSchema, readJson } from './lib/schemas.ts';
import { findSkillFiles, readSkillFrontmatter } from './lib/skills.ts';

export const TABLE_START = '<!-- plugins:start -->';
export const TABLE_END = '<!-- plugins:end -->';

/** Escapes a value for a Markdown table cell. */
function cell(text: string): string {
  return text.replace(/\|/g, '\\|').replace(/\s*\r?\n\s*/g, ' ').trim();
}

/** The Markdown table for a repository: one row per marketplace plugin, or one per root skill. */
export function renderTable(root: string): string {
  if (detectLayout(root) === 'marketplace') {
    const marketplace = readJson(join(root, MARKETPLACE_FILE), marketplaceSchema);
    const rows = marketplace.plugins.map((entry) => {
      const link = typeof entry.source === 'string' ? `[${entry.name}](${posix.normalize(entry.source)})` : entry.name;

      return `| ${link} | ${cell(entry.description ?? '')} | \`/plugin install ${entry.name}@${marketplace.name}\` |`;
    });

    return ['| Plugin | Description | Install |', '| --- | --- | --- |', ...rows].join('\n');
  }
  const rows = findSkillFiles(root)
    .filter((path) => path.startsWith(`${SKILLS_DIR}/`))
    .map((path) => {
      const frontmatter = readSkillFrontmatter(join(root, path));
      if (frontmatter.name === undefined) throw new Error(`${path}: frontmatter has no name`);

      return `| [${frontmatter.name}](${path}) | ${cell(frontmatter.description ?? '')} |`;
    });

  return ['| Skill | Description |', '| --- | --- |', ...rows].join('\n');
}

/** Returns the README text with the block between the markers replaced by `table`. Throws when the markers are not exactly one ordered pair. */
export function replaceTable(readme: string, table: string): string {
  const start = readme.indexOf(TABLE_START);
  const end = readme.indexOf(TABLE_END);
  if (start === -1 || end === -1 || end < start || readme.includes(TABLE_START, start + 1) || readme.includes(TABLE_END, end + 1)) {
    throw new Error(`README.md must contain exactly one ${TABLE_START} followed by one ${TABLE_END}`);
  }

  return `${readme.slice(0, start + TABLE_START.length)}\n${table}\n${readme.slice(end)}`;
}

if (import.meta.main) {
  const { values } = parseArgs({
    options: { root: { type: 'string', default: process.cwd() }, check: { type: 'boolean', default: false } },
  });
  const root = resolve(values.root);
  const readmePath = join(root, 'README.md');
  const current = readFileSync(readmePath, 'utf8');
  const next = replaceTable(current, renderTable(root));
  if (values.check) {
    if (next !== current) {
      console.error('check-readme: the README table is out of date; run `pnpm run readme`');
      process.exitCode = 1;
    } else console.log('check-readme: ok');
  } else if (next !== current) {
    writeFileSync(readmePath, next);
    console.log('readme: table updated');
  } else console.log('readme: table already current');
}
