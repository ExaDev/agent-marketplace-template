import { spawnSync } from 'node:child_process';

/** Runs a command with inherited stdio and throws when it exits non-zero. */
export function runInherited(command: string, args: readonly string[], cwd: string): void {
  const result = spawnSync(command, args, { cwd, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} exited with ${String(result.status)} in ${cwd}`);
}

/** Runs a command and returns its stdout; throws with stderr when it exits non-zero. */
export function runCaptured(command: string, args: readonly string[], cwd: string, env?: NodeJS.ProcessEnv): string {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8', env: env ?? process.env });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} exited with ${String(result.status)} in ${cwd}\n${result.stderr}`);
  }

  return result.stdout;
}
