import type { ReleaseWorkspaceOptions } from '@exadev/semantic-release-workspace';
import { RELEASE_RULES } from './commit-types.ts';

/**
 * Tag format for every plugin release, the one place it is set.
 *
 * `<plugin>--v<version>` is the format `claude plugin tag` writes, and Claude Code resolves a dependent's
 * version range by searching this repository for `<plugin>--v*` tags, so cross-repository dependencies on these
 * plugins only resolve with this format. The cost is a double hyphen in tag names. A `/` delimiter
 * (`${name}/v${version}`) reads better and is valid for git, but `claude plugin tag` cannot create such tags and
 * dependents in other repositories fail with "has no git tag satisfying <range>". Changing the format starts a
 * fresh tag namespace, so rename existing tags in the same change.
 */
const TAG_FORMAT = '${name}--v${version}';

const config: ReleaseWorkspaceOptions = {
  tagFormat: TAG_FORMAT,
  // The default per-package mode needs @semantic-release/git: it commits each plugin's bumped files back to the branch.
  commitStrategy: 'per-package',
  analyzeCommits: { preset: 'conventionalcommits', releaseRules: [...RELEASE_RULES] },
  generateNotes: { preset: 'conventionalcommits' },
  plugins: [
    ['@semantic-release/changelog', { changelogFile: 'CHANGELOG.md' }],
    // Plugins are private packages: this bumps package.json and never publishes to npm.
    ['@semantic-release/npm', { npmPublish: false }],
    // Runs with the plugin's directory (plugins/<name>) as cwd, after the npm step has bumped package.json and before the git step commits.
    ['@semantic-release/exec', { prepareCmd: 'pnpm exec tsx ../../scripts/sync-plugin-version.ts --root ../.. --plugin-dir .' }],
    [
      '@semantic-release/git',
      {
        assets: ['CHANGELOG.md', 'package.json', '.claude-plugin/plugin.json'],
        message: 'chore(release): ${nextRelease.gitTag} [skip ci]',
      },
    ],
  ],
};

export default config;
