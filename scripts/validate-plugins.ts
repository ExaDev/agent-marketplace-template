import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { listPluginNames, PLUGINS_DIR } from './lib/layout.ts';
import { runInherited } from './lib/run.ts';

/**
 * Validates the marketplace and then each plugin directory with `claude plugin validate --strict`. The Claude
 * Code command defaults to `claude`; set CLAUDE_COMMAND to run it another way, for example
 * `npx --yes @anthropic-ai/claude-code` in a CI job that has not installed it.
 */
export function validatePlugins(root: string, claudeCommand: string): void {
  const [program, ...baseArgs] = claudeCommand.split(/\s+/).filter((part) => part !== '');
  if (program === undefined) throw new Error('CLAUDE_COMMAND is empty');
  const validate = (target: string): void => runInherited(program, [...baseArgs, 'plugin', 'validate', target, '--strict'], root);
  validate('.');
  for (const name of listPluginNames(root)) validate(join(PLUGINS_DIR, name));
}

if (import.meta.main) {
  const { values } = parseArgs({ options: { root: { type: 'string', default: process.cwd() } } });
  validatePlugins(resolve(values.root), process.env.CLAUDE_COMMAND ?? 'claude');
}
