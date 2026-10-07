import type { Configuration } from 'lint-staged';

/** Each task ignores the file list and runs a whole-repository check, because every check here is cross-file. */
const config: Configuration = {
  '*.ts': () => 'pnpm run typecheck',
  '**/SKILL.md': () => 'pnpm run check:skills',
  // content:claude:start
  '{.claude-plugin/marketplace.json,plugins/*/.claude-plugin/plugin.json,plugins/*/package.json}': () => 'pnpm run check:versions',
  // content:claude:end
  '{README.md,**/SKILL.md,.claude-plugin/marketplace.json}': () => 'pnpm run check:readme',
};

export default config;
