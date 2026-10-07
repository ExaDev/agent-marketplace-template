import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

/** Creates an empty temporary directory and returns it with a function that deletes it. */
export function makeTempDir(prefix: string): { dir: string; remove: () => void } {
  const dir = mkdtempSync(join(tmpdir(), `${prefix}-`));
  return { dir, remove: () => rmSync(dir, { recursive: true, force: true }) };
}

/** Writes `files` (repository-relative path to content) under `root`, creating directories. Objects are written as JSON. */
export function writeFiles(root: string, files: Readonly<Record<string, string | object>>): void {
  for (const [path, content] of Object.entries(files)) {
    const full = join(root, path);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, typeof content === 'string' ? content : `${JSON.stringify(content, null, 2)}\n`);
  }
}

/** A SKILL.md with the given frontmatter lines. */
export function skillFile(frontmatter: readonly string[]): string {
  return `---\n${frontmatter.join('\n')}\n---\n\nBody.\n`;
}
