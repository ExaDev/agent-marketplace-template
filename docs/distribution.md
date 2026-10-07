# Distributing the marketplace

A marketplace is a git repository with `.claude-plugin/marketplace.json`. Anyone who can clone it can register it and install from it. This page covers the ways to get it onto people's machines, from one person to a whole organisation. The authority for all of it is Claude Code's documentation: [install and manage plugins](https://code.claude.com/docs/en/plugins/install), [host and maintain a marketplace](https://code.claude.com/docs/en/plugins/host-marketplace) and [manage plugins for your organisation](https://code.claude.com/docs/en/plugins/org).

Two names matter. The marketplace name is the `name` in `marketplace.json`, and it is what people type after the `@`. It is not the repository name. The plugin name is the entry's `name`, and it should equal the `name` in the plugin's own `plugin.json`.

## Interactive

In a Claude Code session:

```text
/plugin marketplace add <owner>/<repo>
/plugin install example-skills@<marketplace-name>
```

`/plugin install` in a session opens the plugin's details so the person can review it and choose a scope. Add `#<ref>` to pin the marketplace to a branch or tag, as in `<owner>/<repo>#v1.2.0`. A git host other than GitHub needs the full clone URL, because `owner/repo` always means github.com. To add a marketplace and install in one step, run `/plugin install <plugin> --marketplace <owner>/<repo>` (Claude Code v2.1.275 or later).

## Command line

The same operations work from a shell, which suits setup scripts:

```bash
claude plugin marketplace add <owner>/<repo>
claude plugin install example-skills@<marketplace-name> --scope project
```

The scope is `user` by default, or `project` (recorded in the repository's `.claude/settings.json`) or `local` (`.claude/settings.local.json`). Plugins installed this way load at the next session start, or on `/reload-plugins` in an open one. `claude plugin marketplace list`, `update` and `remove`, and `claude plugin update <plugin>@<marketplace>`, manage what is installed.

## The plugin UI

`/plugin` opens a panel. Discover lists the plugins from registered marketplaces and the Marketplaces tab lists the marketplaces, where one can be updated, removed or have auto-update switched on. In the desktop app's Code tab use the plus button, then Plugins. In VS Code type `/plugins`.

## One repository: `.claude/settings.json`

To make a marketplace and some of its plugins available to everyone working in a repository, commit this to that repository's `.claude/settings.json`:

```json
{
  "extraKnownMarketplaces": {
    "your-marketplace": {
      "source": { "source": "github", "repo": "your-org/your-marketplace" }
    }
  },
  "enabledPlugins": {
    "example-skills@your-marketplace": true
  }
}
```

`claude plugin marketplace add your-org/your-marketplace --scope project` writes the first part for you. Three details decide whether it works:

- `extraKnownMarketplaces` applies only after the person accepts the workspace trust prompt for that folder. In an untrusted folder it is ignored without a message. In a `-p` run it applies only in a folder already trusted interactively.
- A plugin the marketplace lists by a relative path (every plugin in this repository) loads from the marketplace copy once the marketplace is registered. A plugin listed by an external source, such as its own GitHub repository, is enabled but not installed, and each person sees `Plugin "<name>" is enabled in project settings but isn't installed` until they run `claude plugin install <name>@<marketplace> --scope project`.
- If a plugin depends on another marketplace, register that marketplace here too. See [cross-marketplace.md](cross-marketplace.md).

Cloud sessions, including claude.ai/code, do not load the plugins in a repository's `.claude/settings.json`.

## Managed settings for an organisation

Administrators can register a marketplace and turn plugins on for every machine, and users cannot override it. The same JSON goes in a managed settings file, an MDM policy or the server-managed settings in the claude.ai admin console (Team and Enterprise). The file locations are `/Library/Application Support/ClaudeCode/managed-settings.json` on macOS, `/etc/claude-code/managed-settings.json` on Linux and WSL, and `C:\Program Files\ClaudeCode\` on Windows.

```json
{
  "extraKnownMarketplaces": {
    "your-marketplace": {
      "source": { "source": "github", "repo": "your-org/your-marketplace" },
      "autoUpdate": true
    }
  },
  "enabledPlugins": {
    "example-bundle@your-marketplace": true
  }
}
```

Claude Code registers the marketplace and installs the plugins at the start of the user's next session. `enabledPlugins` set to `false` blocks a plugin at every scope. Managed settings are the place to set `autoUpdate`: auto-update is off by default for marketplaces other than Anthropic's, and `marketplace.json` has no field to turn it on.

### Restricting which marketplaces can be added

`strictKnownMarketplaces` in managed settings is an allowlist of marketplace sources. It does not register anything: a marketplace must also be in `extraKnownMarketplaces`, and that entry must pass the allowlist.

```json
{
  "strictKnownMarketplaces": [
    { "source": "github", "repo": "your-org/*" },
    { "source": "skills-dir" }
  ]
}
```

An entry without `ref` does not cover a source that has one, and `github` and `git` spellings of the same repository are different values, so a marketplace that can be cloned more than one way is easier to allow with a `hostPattern` entry. An empty list, `[]`, locks out every marketplace, including Anthropic's. Once any allowlist is set, plugins kept in `.claude/skills/` stop loading unless `{ "source": "skills-dir" }` is in the list. `blockedMarketplaces` takes the same objects and is checked first. `owner/*` wildcards need Claude Code v2.1.223 or later.

## Keeping people up to date

A user receives a new copy of a plugin only when its version changes: it comes from `plugin.json`, and this template bumps it on release. Without auto-update, people run `/plugin marketplace update <name>` or `claude plugin update <plugin>@<name>`. For a private marketplace see [private-repo-auth.md](private-repo-auth.md).

<!-- content:skills:start -->
To install the same skills into agents other than Claude Code, see [skills-cli.md](skills-cli.md).
<!-- content:skills:end -->
