import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { makeTempDir, writeFiles } from './lib/fixture.ts';
import { syncPluginVersions } from './sync-plugin-version.ts';

function plugin(packageVersion: string, manifestVersion: string): { dir: string; remove: () => void } {
  const fixture = makeTempDir('sync-version');
  writeFiles(fixture.dir, {
    'plugins/p/package.json': { name: 'p', version: packageVersion, private: true },
    'plugins/p/.claude-plugin/plugin.json': `{\n  "name": "p",\n  "version": "${manifestVersion}",\n  "author": { "name": "o" }\n}\n`,
  });
  return fixture;
}

describe('sync-plugin-version', () => {
  it('reports a mismatch in check mode and leaves the file alone', () => {
    const { dir, remove } = plugin('1.2.0', '1.1.0');
    try {
      assert.match(syncPluginVersions(dir, true).messages.join('\n'), /package\.json is 1\.2\.0 but plugin\.json is 1\.1\.0/);
      assert.match(readFileSync(join(dir, 'plugins/p/.claude-plugin/plugin.json'), 'utf8'), /1\.1\.0/);
    } finally {
      remove();
    }
  });

  it('copies the package version and keeps the rest of the file byte for byte', () => {
    const { dir, remove } = plugin('1.2.0', '1.1.0');
    try {
      assert.deepEqual(syncPluginVersions(dir, false).messages, []);
      assert.equal(
        readFileSync(join(dir, 'plugins/p/.claude-plugin/plugin.json'), 'utf8'),
        '{\n  "name": "p",\n  "version": "1.2.0",\n  "author": { "name": "o" }\n}\n',
      );
      assert.deepEqual(syncPluginVersions(dir, true).messages, []);
    } finally {
      remove();
    }
  });
});
