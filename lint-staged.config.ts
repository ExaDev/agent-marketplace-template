import type { Configuration } from 'lint-staged';

const config: Configuration = {
  // The one per-file task. --no-warn-ignored because ESLint ignores some staged files by design (AGENTS.md and CLAUDE.md are symlinks to README.md), which it otherwise reports as a warning.
  '*.{ts,js,mjs,json,md}': 'eslint --fix --cache --max-warnings 0 --no-warn-ignored',
  // The tasks below ignore the file list and run a whole-repository check, because each is cross-file.
  '*.ts': () => 'pnpm run typecheck',
  '**/SKILL.md': () => 'pnpm run check:skills',
  // content:claude:start
  'plugins/*/package.json': () => 'pnpm run check:versions',
  // content:claude:end
  '{README.md,**/SKILL.md,.claude-plugin/marketplace.json}': () => 'pnpm run check:readme',
};

export default config;
