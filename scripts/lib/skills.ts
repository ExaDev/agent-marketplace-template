import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { parse } from 'yaml';
import { z } from 'zod';

/** Directories never searched for skills. */
const IGNORED_DIRECTORIES = new Set(['node_modules', '.git']);

const frontmatterSchema = z.looseObject({
  name: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  metadata: z.looseObject({ internal: z.boolean().optional() }).optional(),
});

export type SkillFrontmatter = z.infer<typeof frontmatterSchema>;

/** Every SKILL.md under `root`, as repository-relative POSIX paths, sorted. */
export function findSkillFiles(root: string): string[] {
  const found: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      if (IGNORED_DIRECTORIES.has(entry)) continue;
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (entry === 'SKILL.md') found.push(relative(root, full).split(sep).join('/'));
    }
  };
  walk(root);
  return found.sort();
}

/** Parses the YAML frontmatter of a SKILL.md; throws when it is absent or malformed. */
export function readSkillFrontmatter(path: string): SkillFrontmatter {
  const text = readFileSync(path, 'utf8');
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  if (match?.[1] === undefined) throw new Error(`${path}: no YAML frontmatter`);
  const parsed = frontmatterSchema.safeParse(parse(match[1]));
  if (!parsed.success) throw new Error(`${path}: ${z.prettifyError(parsed.error)}`);
  return parsed.data;
}
