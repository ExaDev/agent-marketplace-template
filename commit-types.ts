import { contentScopes } from './scripts/lib/layout.ts';

/** How a commit type affects the version of the plugin (or skill set) it touches. `false` means no release. */
export type ReleaseImpact = 'minor' | 'patch' | false;

export interface CommitType {
  type: string;
  description: string;
  release: ReleaseImpact;
}

/** The single list of commit types: commitlint accepts exactly these and semantic-release derives its release rules from them. */
export const COMMIT_TYPES: readonly CommitType[] = [
  { type: 'feat', description: 'A new capability for users of the content', release: 'minor' },
  { type: 'fix', description: 'A bug fix in shipped content', release: 'patch' },
  { type: 'perf', description: 'A change that makes shipped content cheaper to run', release: 'patch' },
  { type: 'revert', description: 'Reverts an earlier commit', release: 'patch' },
  { type: 'docs', description: 'Documentation only', release: false },
  { type: 'style', description: 'Formatting with no change in meaning', release: false },
  { type: 'refactor', description: 'A restructure with no change in behaviour', release: false },
  { type: 'test', description: 'Tests only', release: false },
  { type: 'build', description: 'Build system or dependency changes', release: false },
  { type: 'ci', description: 'Continuous integration configuration', release: false },
  { type: 'chore', description: 'Maintenance that touches no shipped content', release: false },
];

export const COMMIT_TYPE_NAMES: readonly string[] = COMMIT_TYPES.map(({ type }) => type);

/**
 * Commits the release tool writes itself: its release commits and its dependency-bump commits both end in
 * `[skip ci]`, which the commit message rule rejects in every other message. commitlint ignores these; the
 * CI-skip guard still scans pull request commits for the token whatever their type.
 */
export const RELEASE_TOOL_COMMIT = /^chore\((?:release|deps)\):/;

/**
 * Scopes allowed besides the live content names: `deps` and `release` are what the release tool writes, the
 * rest name areas of the repository that are not a plugin or skill.
 */
export const FIXED_SCOPES: readonly string[] = ['deps', 'release', 'ci', 'docs', 'repo'];

/** Release rules for @semantic-release/commit-analyzer: breaking changes are major, then each type's own impact. */
export const RELEASE_RULES: readonly { breaking?: true; type?: string; release: 'major' | ReleaseImpact }[] = [
  { breaking: true, release: 'major' },
  ...COMMIT_TYPES.map(({ type, release }) => ({ type, release })),
];

/** Every scope a commit may use in the repository at `root`: its plugin or skill names plus the fixed scopes. */
export function allowedScopes(root: string): string[] {
  return [...contentScopes(root), ...FIXED_SCOPES];
}
