# agent-marketplace-template

A template for a plugin marketplace that Claude Code installs from and that skills tooling (the `skills` CLI) can read, so every skill is written once and reaches both. It carries a working example of every Claude Code plugin component type, per-plugin releases, commit linting, CI and the docs a team needs to run it. MIT licensed.

## Quick start

Use the initialiser. It asks for a name, owner and content set, writes the placeholders, validates the result and can create the repository for you:

```bash
npm create agent-marketplace
npm create claude-marketplace
```

The two names are the same tool. Flags go after `--`:

```bash
npm create agent-marketplace -- --content skills,claude
```

Or use the template directly: press "Use this template" on GitHub, or run `gh repo create <owner>/<name> --template ExaDev/agent-marketplace-template --private --clone`, then run `pnpm install` and `pnpm run init` in the clone. The initialiser calls the same `init` script, so both routes give the same result.

Requirements: the latest Node LTS, pnpm (the version is pinned in `packageManager`) and git. The Claude Code CLI is needed to run the plugin validation.

## Initialiser options

- `--name`: the repository and package name. Asked for when omitted.
- `--marketplace-name`: the name of the Claude Code marketplace, written to `.claude-plugin/marketplace.json` and to the install commands. It defaults to `--name`, and differs from it when a marketplace called `acme` lives in a repository called `agent-marketplace`. It needs the `claude` content type.
- `--contact`: an email address or an http(s) URL that receives security reports and code of conduct reports. It is written to `SECURITY.md` and `CODE_OF_CONDUCT.md` for every content set. Asked for when omitted, and an error with `--yes`.
- `--owner`, `--org`, `--licence`, `--examples`, `--dir`, `--yes` and `--no-validate`: run `pnpm run init --help` for each.

The initialiser also replaces this README with one written for the generated repository, from `scripts/init/README.template.md`, and gives the marketplace a neutral description in place of the template's. It writes the repository's own organisation and name into the documentation's install and API examples, and `repository`, `homepage` and `bugs` into `package.json` and each plugin manifest.

## Content options

`--content` takes a comma-separated list of content types. The default is `all`, which is shorthand for `skills,claude`. Order does not matter and duplicates collapse. An unknown value or an empty list is an error that names the valid ones.

- `claude`: a Claude Code plugin marketplace. It keeps `.claude-plugin/`, `plugins/`, per-plugin releases and plugin validation. It drops the `skills` CLI docs and the check that the `skills` CLI lists each skill once.
- `skills`: a plain skills repository with `skills/<name>/SKILL.md` at the root, found by the `skills` CLI and usable by any agent. Everything plugin-shaped is dropped: no `.claude-plugin/`, no `plugins/`, no plugin versions, no per-plugin release. Commit linting, CI and the skill front matter and unique-name check stay.
- `skills,claude` (the same as `all`): the plugin marketplace plus the `skills` CLI docs and the listing check.

Skills live once, inside their plugin, so `claude` and `skills,claude` produce the same layout. The `skills` CLI finds plugin skills by reading the marketplace entries, whatever you choose, so choosing `claude` alone cannot hide them from it. It only means this repository does not advertise or test that route.

The template carries every file. A manifest in `scripts/content.ts` records which content type owns which paths, workflow jobs, README sections, scripts and dev dependencies, and `init` deletes what the unselected types own. Files every shape needs (commit lint, the CI skeleton, the docs shell) belong to an always-kept core.

## Plugins

<!-- plugins:start -->
| Plugin | Description | Install |
| --- | --- | --- |
| [example-agents](plugins/example-agents) | Minimal example of the agent component type: two subagent personas. | `/plugin install example-agents@agent-marketplace-template` |
| [example-bin](plugins/example-bin) | Minimal example of a plugin executable on the Bash tool PATH. | `/plugin install example-bin@agent-marketplace-template` |
| [example-bundle](plugins/example-bundle) | Minimal example of a bundle: a plugin with no components that installs other plugins as dependencies. | `/plugin install example-bundle@agent-marketplace-template` |
| [example-commands](plugins/example-commands) | Minimal example of the command component type: one flat slash command that takes arguments. | `/plugin install example-commands@agent-marketplace-template` |
| [example-hooks](plugins/example-hooks) | Minimal example of plugin hooks: a PreToolUse Bash guard and an opt-in, hash-tracked SessionStart installer. | `/plugin install example-hooks@agent-marketplace-template` |
| [example-lsp](plugins/example-lsp) | Minimal example of a plugin-provided language server configuration for TypeScript and JavaScript. | `/plugin install example-lsp@agent-marketplace-template` |
| [example-mcp](plugins/example-mcp) | Minimal example of a plugin-provided MCP server: a dependency-free stdio server with one tool. | `/plugin install example-mcp@agent-marketplace-template` |
| [example-monitors](plugins/example-monitors) | Minimal example of a plugin background monitor. | `/plugin install example-monitors@agent-marketplace-template` |
| [example-output-styles](plugins/example-output-styles) | Minimal example of a plugin-provided output style. | `/plugin install example-output-styles@agent-marketplace-template` |
| [example-settings](plugins/example-settings) | Minimal example of plugin default settings, including the agent setting. | `/plugin install example-settings@agent-marketplace-template` |
| [example-skills](plugins/example-skills) | Minimal example of the skill component type: two skills, one with a reference file and a script, one that reads a shared file. | `/plugin install example-skills@agent-marketplace-template` |
| [example-themes](plugins/example-themes) | Minimal example of a plugin colour theme. | `/plugin install example-themes@agent-marketplace-template` |
| [example-workflows](plugins/example-workflows) | Minimal example of a plugin dynamic workflow. | `/plugin install example-workflows@agent-marketplace-template` |
| [marketplace-maintainer](plugins/marketplace-maintainer) | Skills that add, validate and remove plugins in a plugin marketplace checkout. | `/plugin install marketplace-maintainer@agent-marketplace-template` |
| [share-agent-setup](plugins/share-agent-setup) | Contribute a skill, agent, hook or other piece of your Claude Code setup to your own marketplace or to someone else's, or share it directly as a setup prompt. | `/plugin install share-agent-setup@agent-marketplace-template` |
<!-- plugins:end -->

The table between the markers is generated from `.claude-plugin/marketplace.json` by `pnpm run readme`, and `pnpm run check:readme` fails when it is stale. Edit the marketplace file, not the table.

## Using the marketplace

```text
/plugin marketplace add <owner>/<repo>
/plugin install example-skills@<marketplace-name>
```

The marketplace name is the `name` in `.claude-plugin/marketplace.json`, not the repository name; `--marketplace-name` sets it.
<!-- content:claude:start -->
To install the skills with the `skills` CLI instead, run `npx skills add <owner>/<repo>`. [docs/distribution.md](docs/distribution.md) covers the other ways to put a marketplace in front of a team.
<!-- content:claude:end -->

## Layout

```text
.claude-plugin/marketplace.json   the catalogue, one entry per plugin
plugins/<name>/                   one pnpm workspace package per plugin
scripts/                          init, version sync, checks, README table
eslint.config.ts                  the shared ESLint config, applied to this repository itself
.github/workflows/                ci, ci-skip-guard, merge-when-green, template-selfcheck
docs/                             authoring, distribution, releasing and the rest
```

Each plugin is a private pnpm workspace package. Its `package.json` carries the version, the release tool bumps it, and a release step copies it into the plugin's `.claude-plugin/plugin.json`. Marketplace entries carry no `version`, because Claude Code ignores the entry's value when `plugin.json` sets one and `claude plugin validate` warns about the pair. The `agentSkills` rules of the shared ESLint config enforce this and the other structural conventions: skill names equal their directory and are unique, entries and manifests agree with the plugin directories, and `plugin.json` carries the version in `package.json`.

## Commands

| Command | Purpose |
| --- | --- |
| `pnpm run validate` | Everything CI runs on a pull request apart from commit linting: type-check, lint, the tests, the skills and version checks, the README table and plugin validation |
| `pnpm run typecheck` | Type-check the scripts |
| `pnpm run lint` | Lint the scripts, JSON, Markdown, every `SKILL.md` and the marketplace and plugin manifests with the shared ESLint config |
| `pnpm run lint:fix` | The same, applying the fixes, including the canonical layout of the JSON files |
| `pnpm run test` | Run the tests of the scripts (part of `validate`) |
| `pnpm run check:skills` | Every `SKILL.md` sits where the `skills` CLI finds it, one listing per tool, no plugin name Claude Code reserves |
| `pnpm run check:versions` | Each plugin's `package.json` carries a version and is named for its directory |
| `pnpm run check:readme` | The plugin table is up to date |
| `pnpm run check:ci-skip` | No CI skip tokens in commit messages |
| `pnpm run lint:commits` | Lint commit messages |
| `pnpm run readme` | Regenerate the plugin table |
| `pnpm run release` | Release changed plugins (CI runs this on `main`) |
| `pnpm run init` | Apply a content set and fill in the placeholders |

## Documentation

- [CONTRIBUTING.md](CONTRIBUTING.md): the path from a first change to a merged pull request
<!-- content:claude:start -->
- [docs/authoring.md](docs/authoring.md): every component type, with the example plugin to copy
<!-- content:claude:end -->
<!-- content:claude:start -->
- [docs/distribution.md](docs/distribution.md): how people and teams install from the marketplace
<!-- content:claude:end -->
<!-- content:claude:start -->
- [docs/cross-marketplace.md](docs/cross-marketplace.md): listing and depending on plugins from other repositories
<!-- content:claude:end -->
<!-- content:skills:start -->
- [docs/skills-cli.md](docs/skills-cli.md): installing the same skills with the `skills` CLI
<!-- content:skills:end -->
<!-- content:claude:start -->
- [docs/releasing.md](docs/releasing.md): versions, tags and the release job
<!-- content:claude:end -->
- [docs/rulesets.md](docs/rulesets.md): a ruleset recipe for `main`
- [docs/private-repo-auth.md](docs/private-repo-auth.md): git credentials for a private marketplace
- [SECURITY.md](SECURITY.md) and [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)

Claude Code's own documentation is the authority for plugin behaviour: [plugins](https://code.claude.com/docs/en/plugins), [creating a marketplace](https://code.claude.com/docs/en/plugins/create-marketplace) and [the marketplace reference](https://code.claude.com/docs/en/plugins/marketplace-reference).

## Licence

MIT, see [LICENSE](LICENSE). A repository generated from this template can use any licence; the initialiser asks.
