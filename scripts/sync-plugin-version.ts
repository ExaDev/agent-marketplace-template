import { readFileSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { listPluginNames, PLUGINS_DIR } from './lib/layout.ts';
import { Problems } from './lib/problems.ts';
import { packageJsonSchema, pluginManifestSchema, readJson } from './lib/schemas.ts';

/** Matches the top-level "version" member so it can be replaced without reformatting the rest of plugin.json. */
const VERSION_MEMBER = /("version"\s*:\s*)"[^"]*"/;

/**
 * Makes each plugin's `.claude-plugin/plugin.json` version equal the version in its `package.json`, which the
 * release tool bumps. Whether the two agree is an ESLint rule (`exadev/plugin-manifest`); what that rule does
 * not read is the `package.json` itself, which the release tool names its tags after, so with `check` this only
 * reports a `package.json` that has no version or is not named for its plugin directory, and writes nothing.
 */
export function syncPluginVersions(root: string, check: boolean, only?: string): Problems {
  const problems = new Problems();
  const names = only === undefined ? listPluginNames(root) : [only];

  for (const name of names) {
    const dir = join(root, PLUGINS_DIR, name);
    const pkg = readJson(join(dir, 'package.json'), packageJsonSchema);

    if (pkg.version === undefined) {
      problems.add(`${PLUGINS_DIR}/${name}/package.json has no version`);
      continue;
    }

    if (pkg.name !== name) problems.add(`${PLUGINS_DIR}/${name}/package.json is named "${pkg.name}", not "${name}"`);

    if (check) continue;

    const manifestPath = join(dir, '.claude-plugin', 'plugin.json');
    const manifest = readJson(manifestPath, pluginManifestSchema);

    if (manifest.version === pkg.version) continue;

    const text = readFileSync(manifestPath, 'utf8');

    if (!VERSION_MEMBER.test(text)) throw new Error(`${manifestPath} has no version member to update`);

    writeFileSync(manifestPath, text.replace(VERSION_MEMBER, `$1"${pkg.version}"`));
    console.log(`sync-plugin-version: ${name} plugin.json -> ${pkg.version}`);
  }

  return problems;
}

if (import.meta.main) {
  const { values } = parseArgs({
    options: {
      root: { type: 'string', default: process.cwd() },
      'plugin-dir': { type: 'string' },
      check: { type: 'boolean', default: false },
    },
  });
  const root = resolve(values.root);
  const pluginDir = values['plugin-dir'];
  process.exitCode = syncPluginVersions(root, values.check, pluginDir === undefined ? undefined : basename(resolve(pluginDir))).report('sync-plugin-version');
}
