# Releasing

Each plugin is released on its own. A merge to `main` runs the release workflow, which versions and tags only the plugins whose files changed since their last release, using [`@exadev/semantic-release-workspace`](https://www.npmjs.com/package/@exadev/semantic-release-workspace) on top of semantic-release. Plugins are private packages, so nothing is published to npm.

## How a release is decided

The tool reads the pnpm workspace globs in `pnpm-workspace.yaml` and treats every directory under `plugins/` as a package. A commit belongs to a plugin if it touches that plugin's files, and the conventional commit type sets the bump: `feat` is a minor release, `fix` and `perf` a patch, and a breaking change a major. Types that touch no shipped content (`docs`, `chore`, `ci` and the rest) release nothing. `commit-types.ts` is the single list, feeding both commitlint and the release rules. If a plugin depends on another workspace package that was bumped, it gets a patch release too, and releases go in dependency order.

For each released plugin the tool:

1. bumps `version` in the plugin's `package.json`,
2. copies that version into the plugin's `.claude-plugin/plugin.json` (an `@semantic-release/exec` step),
3. writes the plugin's `CHANGELOG.md`,
4. commits those files and pushes the branch and the tag `<plugin>--v<version>`.

Marketplace entries carry no `version`. Claude Code reads the version from `plugin.json` first, and setting it in both places draws a validate warning, so no root file needs syncing. `pnpm run check:versions` fails when a plugin's `package.json` and `plugin.json` disagree or when an entry sets a version. Because the version string is what tells Claude Code a plugin changed, a plugin that changes without a release is not picked up by people who installed it.

## Tags

The tag format is `<plugin>--v<version>`. It matches what `claude plugin tag` produces and what a dependent plugin's version range searches for. The format is the `tagFormat` option, set once as `TAG_FORMAT` in `release-workspace.config.ts` at the repository root. The tool accepts `${name}` and `${version}` in it and requires `${version}`. Changing it to `<plugin>/v<version>` is valid for git but means `claude plugin tag` cannot create the tags and dependents in other repositories cannot resolve a range. See [cross-marketplace.md](cross-marketplace.md).

`claude plugin tag --dry-run`, run in a plugin directory, shows the tag Claude Code would create, which should equal the one the release tool names in its own dry run.

## The release job

The `release` job in `.github/workflows/ci.yml` runs on every push to `main`, one run at a time, and calls `pnpm run release`. It checks out the full history and authenticates with the `RELEASE_TOKEN` repository secret, falling back to the workflow token when the secret is absent.

The tool pushes directly to `main`. It does not open a pull request, and a pull-request based release plugin cannot be combined with it. That has two consequences.

- On a repository with no ruleset on `main`, the fallback token is enough. A push made with the workflow token does not start further workflow runs.
- On a repository whose ruleset requires pull requests, the identity that pushes must be a bypass actor, or the push is rejected. Create a GitHub App, install it on the repository, and put an installation token in the `RELEASE_TOKEN` secret (a fine-grained personal access token with contents write is the simpler fallback, and a deploy key with write access also works as a bypass actor). See [rulesets.md](rulesets.md) for the ruleset entry.

The release commit message (`chore(release): <tag> [skip ci]`) is written by the release tool and carries a CI skip token, so it does not start another run of the workflows. That is also why the skip guard inspects only pull request commits.

## Dry run

To see what would be released without tagging, committing or pushing anything, run `pnpm run release --dry-run` in a clean checkout and read which plugins, versions and tags it names. Do not run a real release from a laptop.

## Pinned dependencies

`conventional-changelog-conventionalcommits` is pinned to an exact version. A hoisted newer copy has been seen to drop commit bodies from release notes, so upgrade it deliberately and read a changelog afterwards.
