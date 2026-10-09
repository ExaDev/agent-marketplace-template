import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { makeTempDir, writeFiles } from './lib/fixture.ts';
import { syncPluginVersions } from './sync-plugin-version.ts';

const MANIFEST_PATH = 'plugins/p/.claude-plugin/plugin.json';

function plugin(packageJson: object, manifestVersion = '1.1.0'): { dir: string; remove: () => void } {
  const fixture = makeTempDir('sync-version');

  writeFiles(fixture.dir, {
    'plugins/p/package.json': packageJson,
    [MANIFEST_PATH]: `{\n  "name": "p",\n  "version": "${manifestVersion}",\n  "author": { "name": "o" }\n}\n`,
  });

  return fixture;
}

void describe('sync-plugin-version', () => {
  void it('copies the package version and keeps the rest of the file byte for byte', () => {
    const { dir, remove } = plugin({ name: 'p', version: '1.2.0', private: true });

    try {
      assert.deepEqual(syncPluginVersions(dir, false).messages, []);
      assert.equal(readFileSync(join(dir, MANIFEST_PATH), 'utf8'), '{\n  "name": "p",\n  "version": "1.2.0",\n  "author": { "name": "o" }\n}\n');
    } finally {
      remove();
    }
  });

  void it('leaves a manifest that already matches untouched', () => {
    const { dir, remove } = plugin({ name: 'p', version: '1.1.0', private: true });

    try {
      const before = readFileSync(join(dir, MANIFEST_PATH), 'utf8');

      assert.deepEqual(syncPluginVersions(dir, false).messages, []);
      assert.equal(readFileSync(join(dir, MANIFEST_PATH), 'utf8'), before);
    } finally {
      remove();
    }
  });

  void it('in check mode reports a package.json with no version and writes nothing', () => {
    const { dir, remove } = plugin({ name: 'p', private: true });

    try {
      assert.match(syncPluginVersions(dir, true).messages.join('\n'), /plugins\/p\/package\.json has no version/);
      assert.match(readFileSync(join(dir, MANIFEST_PATH), 'utf8'), /1\.1\.0/);
    } finally {
      remove();
    }
  });

  void it('in check mode reports a package.json named for another plugin and writes nothing', () => {
    const { dir, remove } = plugin({ name: 'other', version: '1.2.0', private: true });

    try {
      assert.match(syncPluginVersions(dir, true).messages.join('\n'), /package\.json is named "other", not "p"/);
      assert.match(readFileSync(join(dir, MANIFEST_PATH), 'utf8'), /1\.1\.0/);
    } finally {
      remove();
    }
  });
});
