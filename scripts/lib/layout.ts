import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/** A repository is either a Claude Code plugin marketplace or a plain skills repository. */
export type Layout = 'marketplace' | 'skills';

export const MARKETPLACE_FILE = join('.claude-plugin', 'marketplace.json');
export const PLUGINS_DIR = 'plugins';
export const SKILLS_DIR = 'skills';

/**
 * Decides which layout a repository root has from the files that define it. Throws when both or neither
 * definition exists, so a half-converted repository fails instead of being validated as the wrong shape.
 */
export function detectLayout(root: string): Layout {
  const marketplace = existsSync(join(root, MARKETPLACE_FILE));
  const skills = existsSync(join(root, SKILLS_DIR));
  if (marketplace && skills) {
    throw new Error(`${root} has both ${MARKETPLACE_FILE} and a root ${SKILLS_DIR}/ directory; a repository is one layout or the other`);
  }
  if (marketplace) return 'marketplace';
  if (skills) return 'skills';
  throw new Error(`${root} has neither ${MARKETPLACE_FILE} nor a root ${SKILLS_DIR}/ directory`);
}

/** Names of the immediate subdirectories of `dir`, sorted, or an empty list when `dir` does not exist. */
export function listSubdirectories(dir: string): string[] {
  if (!existsSync(dir)) return [];

  return readdirSync(dir)
    .filter((entry) => statSync(join(dir, entry)).isDirectory())
    .sort();
}

/** Plugin directory names under `plugins/` (marketplace layout only). */
export function listPluginNames(root: string): string[] {
  return listSubdirectories(join(root, PLUGINS_DIR));
}

/**
 * Commit scopes for a repository: plugin names in the marketplace layout, skill names in the skills layout.
 * Read live so adding a plugin or skill needs no config edit.
 */
export function contentScopes(root: string): string[] {
  const layout = detectLayout(root);

  return layout === 'marketplace' ? listPluginNames(root) : listSubdirectories(join(root, SKILLS_DIR));
}
