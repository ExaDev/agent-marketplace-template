import { existsSync, lstatSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

const IGNORED_DIRECTORIES = new Set(['node_modules', '.git']);
const MARKDOWN_LINK = /\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
const EXTERNAL = /^[a-z][a-z0-9+.-]*:/i;

/** Relative Markdown links in regular files (symbolic links are checked through their target), outside code fences, whose target does not exist, as `file: target` strings. */
export function findBrokenRelativeLinks(root: string): string[] {
  const broken: string[] = [];
  const checkFile = (file: string): void => {
    let fenced = false;
    for (const line of readFileSync(file, 'utf8').split('\n')) {
      if (line.trimStart().startsWith('```')) fenced = !fenced;
      if (fenced) continue;
      for (const match of line.matchAll(MARKDOWN_LINK)) {
        const target = match[1];
        if (target === undefined || EXTERNAL.test(target) || target.startsWith('#')) continue;
        const path = target.split('#')[0] ?? '';
        if (!existsSync(resolve(dirname(file), decodeURIComponent(path)))) broken.push(`${relative(root, file)}: ${target}`);
      }
    }
  };
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      if (IGNORED_DIRECTORIES.has(entry)) continue;
      const full = join(dir, entry);
      const stat = lstatSync(full);
      if (stat.isSymbolicLink()) continue;
      if (stat.isDirectory()) walk(full);
      else if (entry.endsWith('.md')) checkFile(full);
    }
  };
  walk(root);

  return broken;
}
