# Authoring plugins

A plugin is a directory under `plugins/`. Each one is a private pnpm workspace package that carries the version in its `package.json`, with a `.claude-plugin/plugin.json` beside its components, a README with a "Content owner" section, and one entry in `.claude-plugin/marketplace.json` whose `source` is `./plugins/<name>`.

Every component type has one example plugin to copy from. Run any of them in a session without installing it:

```bash
claude --plugin-dir ./plugins/example-skills
```

A plugin name cannot be one Claude Code reserves for Anthropic's own plugins: it cannot start with `claude-`, `anthropic-`, `anthropics-` or `cc-plugin-`, equal `claude`, `anthropic`, `anthropics`, `claude-code` or `claude-mods`, or put `official` beside `claude` or `anthropic`. `pnpm run check:skills` rejects these on any Claude Code version, because an older release accepts the name and only a newer one fails.

Check a plugin or the whole marketplace with `claude plugin validate ./plugins/<name>` and `claude plugin validate .`. Claude Code's references are the authority for field names: [plugin components](https://code.claude.com/docs/en/plugins/components), [the manifest reference](https://code.claude.com/docs/en/plugins/manifest-reference) and [the marketplace reference](https://code.claude.com/docs/en/plugins/marketplace-reference).

Rules that apply to every plugin here:

- Component files go at the plugin root, never inside `.claude-plugin/`. Only `plugin.json` lives there.
- Leave the default locations alone and the manifest needs no component keys. Setting `commands`, `agents`, `outputStyles`, `workflows` or the experimental `themes` and `monitors` keys replaces the default folder scan, which usually surprises people.
- Refer to files inside the plugin through `${CLAUDE_PLUGIN_ROOT}`, which changes on every update, so never write state there. Use `${CLAUDE_PLUGIN_DATA}` for anything that must survive an update.
- A `CLAUDE.md` at the plugin root is not loaded. Put instructions in a skill.
- Do not put `version` in the marketplace entry. See [releasing.md](releasing.md).
<!-- content:skills:start -->
- Never add a `skills` key to a `plugin.json` or an entry. See [skills-cli.md](skills-cli.md).
<!-- content:skills:end -->
- Write `plugin.json`, `package.json` and the marketplace in any key order and run `pnpm run lint:fix`: the shared ESLint config rewrites them to one canonical layout with sorted keys, and `pnpm run lint` fails on anything else.

## Skills

Example: `plugins/example-skills`.

A skill is `skills/<name>/SKILL.md`. The frontmatter needs a `description`, which is what Claude matches against the task, and a `name` equal to the skill's directory. It runs as `/<plugin>:<name>`. Supporting files sit beside it: a `references/` file the skill reads only when it needs it, a `scripts/` file it runs, or a file shared between skills reached by a relative path from the skill's own directory. `word-count` shows the first two and `house-style` the shared file.

Skill names must be unique across the repository, because the `skills` CLI silently drops a second skill with the same name. A skill that only works with its plugin's scripts or hooks is marked `metadata.internal: true` so the `skills` CLI does not list it. The same file serves Claude Code and the `skills` CLI, so do not copy a skill into a second place.

## Commands

Example: `plugins/example-commands`.

A command is a flat Markdown file, `commands/<file>.md`, run as `/<plugin>:<file>`, with the same frontmatter as a skill. `$ARGUMENTS` in the body is replaced by what the user types after the command. Claude Code describes commands as the older format that skills supersede, so write new work as a skill and keep `commands/` for material moved over from `.claude/commands/`.

## Agents

Example: `plugins/example-agents`.

An agent is a Markdown file under `agents/` with frontmatter (`name`, `description`, optionally `model`, `tools` and others) and a system prompt as the body. It appears as `<plugin>:<name>`. Claude Code ignores `permissionMode`, `hooks`, `mcpServers` and `initialPrompt` in a plugin agent, so add hooks and MCP servers to the plugin itself. Frontmatter that does not parse does not fail the load: the agent loads with every field ignored, which `claude plugin validate` reports.

## Hooks

Example: `plugins/example-hooks`.

Hooks live in `hooks/hooks.json`, wrapped in a top-level `"hooks"` key (a file with only the event map fails to load). They are registered when the plugin loads and fire on their events whether or not any of the plugin's skills run, so narrow them with a `matcher`. Wrap `${CLAUDE_PLUGIN_ROOT}` in double quotes in a shell-form `command`, or pass `args` instead, where each element is one argument.

The example has two hooks. The `PreToolUse` Bash guard shows blocking a command. The `SessionStart` installer shows the safe pattern for a hook that writes files into a project: it is opt-in, it records a hash of what it wrote, and it never overwrites a file the user has changed.

## MCP servers

Example: `plugins/example-mcp`.

`.mcp.json` at the plugin root, in the same shape as a project `.mcp.json`. The example is a stdio server written with no dependencies, started with `node` from `${CLAUDE_PLUGIN_ROOT}/servers/`. The server appears in `/mcp` as `plugin:<plugin>:<server>` and its tools are named `mcp__plugin_<plugin>_<server>__<tool>`, which is the name to use in a permission rule or a hook matcher. A local stdio server runs in Claude Code and in Cowork on a machine, not on claude.ai.

## LSP servers

Example: `plugins/example-lsp`.

`.lsp.json` at the plugin root maps each server name directly to its configuration, with no wrapper object. `command` and `extensionToLanguage` (at least one extension, each starting with a dot) are required, and an unknown key makes the whole file be skipped at load. `claude plugin validate` does not read this file, so check it by loading the plugin and looking at the `/plugin` Errors tab. The plugin configures the connection but does not install the language server, so the binary must be on the user's `PATH`.

## Output styles

Example: `plugins/example-output-styles`.

A Markdown file in `output-styles/` with `name` and `description` frontmatter. It appears in `/output-style` as `<plugin>:<name>`.

## Themes

Example: `plugins/example-themes`.

A JSON file in `themes/` in the format of a custom theme file: a `name`, a `base` preset and `overrides`. It appears in `/theme` and is read-only there. The manifest key for a non-default location is `experimental.themes`.

## Monitors

Example: `plugins/example-monitors`.

`monitors/monitors.json` is an array of `{ name, command, description }` objects (optionally `when`). The command runs as a persistent background process and what it prints reaches Claude as notifications. Monitors start only in interactive sessions, cannot reference `${user_config.*}`, and are not stopped if the plugin is disabled mid-session. Claude Code lists them under an `experimental` manifest key, so the manifest shape may change.

## Executables

Example: `plugins/example-bin`.

Files in `bin/` are on the `PATH` of the Bash tool while the plugin is enabled, after the user's own entries, so a plugin cannot shadow a system command. claude.ai and Cowork do not install a plugin with a top-level `bin/`, and organisation sync through claude.ai rejects it. Keep executables in `scripts/` and call them through `${CLAUDE_PLUGIN_ROOT}/scripts/<name>` when the plugin must reach those surfaces.

## Workflows

Example: `plugins/example-workflows`.

`workflows/<name>.js` starts with an `export const meta` object (a `name` and a `description`) and then a script body that orchestrates subagents. It runs as `/<plugin>:<name>`. See [workflows in Claude Code](https://code.claude.com/docs/en/workflows#distribute-a-workflow-in-a-plugin) for the script API.

## Default settings

Example: `plugins/example-settings`.

A `settings.json` at the plugin root applies while the plugin is enabled. Only `agent` (run one of the plugin's agents as the main thread) and `subagentStatusLine` take effect, and every other key is dropped. A user's own value overrides the plugin's.

## Bundles

Example: `plugins/example-bundle`.

A plugin whose manifest holds only `name`, `version`, `description` and a `dependencies` array is a valid bundle: installing it installs every dependency. Entries are `"name"`, `"name@marketplace"` or `{ "name", "marketplace", "version" }`. A semver range resolves against git tags named `<plugin>--v<version>`. For dependencies on other marketplaces see [cross-marketplace.md](cross-marketplace.md).

## Maintaining the marketplace

Example: `plugins/marketplace-maintainer`.

Skills that add, validate and remove plugins in a checkout of this repository. They are the quickest way to create a new plugin in the right shape, and they are written against this repository's layout, so keep them in step when the layout changes.
