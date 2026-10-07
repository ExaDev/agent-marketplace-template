# Installing the skills with the `skills` CLI

The [`skills` CLI](https://github.com/vercel-labs/skills) installs skills into many coding agents (Claude Code, Codex and others), per project or globally. This repository is readable by it as well as by Claude Code, and each skill exists in exactly one place.

```bash
npx skills add <owner>/<repo>
npx skills add <owner>/<repo> --list
npx skills add <owner>/<repo> --skill word-count --agent claude-code
```

`--list` shows what is available without installing, `--skill` picks skills by name, `--agent` picks the target agents, `--global` installs for the user rather than the project, and `--copy` copies files instead of symlinking. A source can also be a full URL or a local path, so `npx skills add .` in a checkout tests what a pull request would publish. For a private repository the CLI uses the credentials already configured for that URL, so see [private-repo-auth.md](private-repo-auth.md).

## How the skills are found

The CLI searches the repository root and `skills/` directories, and it also reads `.claude-plugin/marketplace.json`. For every marketplace entry whose `source` is a local string starting with `./`, it searches that plugin's conventional `skills/` directory, so `plugins/<plugin>/skills/<name>/SKILL.md` is found with no declaration anywhere. It de-duplicates by file path and by skill `name`, and it skips a skill whose frontmatter sets `metadata.internal: true`.

Two consequences shape the repository:

- Entries use `"source": "./plugins/<name>"`. The CLI skips entries whose `source` does not start with `./`, so bare names resolved through `metadata.pluginRoot` would be invisible to it, and `pluginRoot` is not used here.
- Skills must have unique `name` values across the whole repository. A duplicate is silently dropped by the CLI, which `pnpm run check:skills` turns into a failure.

## Why a skill is never declared twice

Claude Code scans a plugin's `skills/` directory by default. A `skills` key in `plugin.json` adds more directories to that scan and, as far as Claude Code's documentation says, nothing about removing duplicates of the same path. The `skills` CLI needs no key at all. So the layout that cannot list a skill twice is one with no declarations: one `SKILL.md` per skill, in the default location, and no `skills` key in any `plugin.json` or marketplace entry. `pnpm run check:skills` fails the build if a `skills` key appears, if two skills share a name, or if a skill would be listed more than once by either tool.

Do not copy a skill into a second directory or symlink it. Copies drift, and symlinks break for contributors on Windows and in synced folders.

## Skills that only work inside their plugin

A skill that needs its plugin's hooks, scripts or MCP server cannot work when installed alone into another agent. Mark it `metadata.internal: true` in the frontmatter so the `skills` CLI hides it, while Claude Code still loads it as part of the plugin.

## Plugins from other repositories

A plugin listed here by a `github`, `git-subdir` or `url` source is not a local `./` entry, so the `skills` CLI does not look inside it through this marketplace. Its skills reach the CLI through the plugin's own repository. Never re-declare them here. See [cross-marketplace.md](cross-marketplace.md).

## A repository with only skills

Generated with `--content skills`, the repository has `skills/<name>/SKILL.md` at the root and no plugins. The CLI finds those natively, and any agent that reads `SKILL.md` can use them.
