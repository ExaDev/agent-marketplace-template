# Plugins from other marketplaces

A marketplace cannot include another marketplace by name, but two mechanisms give the same result without copying files. Both are described in Claude Code's [marketplace reference](https://code.claude.com/docs/en/plugins/marketplace-reference#plugin-sources) and [plugin dependencies](https://code.claude.com/docs/en/plugins/dependencies).

## List a plugin from its own repository

An entry's `source` can point at where the plugin actually lives. The plugin then installs as `<name>@<this marketplace>`, and it stays single-sourced in its own repository. Git sources resolve with the installing machine's git credentials.

```json
{ "name": "formatter", "source": { "source": "github", "repo": "your-org/formatter", "ref": "v2.0.0" } }
```

```json
{
  "name": "formatter",
  "source": { "source": "git-subdir", "url": "https://github.com/your-org/monorepo.git", "path": "tools/formatter", "sha": "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0" }
}
```

```json
{ "name": "formatter", "source": { "source": "url", "url": "https://gitlab.example.com/your-group/formatter.git", "ref": "main" } }
```

- `github` takes `repo` as `owner/repo`. `url` takes a full git URL and no shorthand. `git-subdir` takes a git URL or `owner/repo` shorthand in `url`, and `path` to the subdirectory, fetched by sparse checkout. A `git-subdir` source can point at a plugin inside another marketplace's repository.
- `ref` is a branch or tag. `sha` is a full 40-character lowercase commit. With both set, Claude Code checks out `sha`, so the pin holds even if the tag later moves or is deleted. A tag or branch alone can move, so pin a `sha` when the plugin must not change under you.
- The other source types are `npm`, `archive` (a zip over HTTPS, with a `sha256` pin) and `command`, each with minimum Claude Code versions listed in the marketplace reference. None is enabled in this repository, so it has no external dependency.
- Do not put a `version` in the entry for these either. The version comes from the fetched plugin's own `plugin.json`.
<!-- content:skills:start -->
- A skill listed this way reaches the `skills` CLI through its own repository. Do not re-declare or copy it here, or it would be listed twice. See [skills-cli.md](skills-cli.md).
<!-- content:skills:end -->

## Depend on a plugin from another marketplace

A plugin lists other plugins in `dependencies`, in `plugin.json` or in its marketplace entry:

```json
{ "name": "audit-logger", "marketplace": "your-shared-marketplace", "version": "^1.0" }
```

A string `"audit-logger@your-shared-marketplace"` also works when no version constraint is needed. A plugin whose manifest holds only a `name` and `dependencies` is a bundle that installs a curated set (`plugins/example-bundle`).

Three conditions must hold for a dependency in another marketplace to install:

1. **The root marketplace allows it.** The marketplace that hosts the plugin being installed lists the other marketplace's name in `.claude-plugin/marketplace.json`:

   ```json
   { "allowCrossMarketplaceDependenciesOn": ["your-shared-marketplace"] }
   ```

   Only the root marketplace's list applies, for the whole dependency chain. If the field is missing, an entry-declared dependency refuses the install with `Dependency "..." is in marketplace "...", which is not in the allowlist`, and a dependency declared in `plugin.json` is skipped silently and the plugin then fails to load. A dependency the user has already installed and enabled at the same scope bypasses the check.
2. **The dependency's marketplace is registered on the machine.** Claude Code does not add a marketplace on behalf of a plugin. When it is missing, the error is `Dependency "<dep>" is not installed`, and the documented fix is to add that marketplace and run `/reload-plugins`, which installs the missing dependencies it can resolve. Adding the marketplace after the dependent plugin is installed also resolves the dependency (the add reports it as an added dependency). For a team, register every marketplace a bundle depends on in the project's `extraKnownMarketplaces`, beside `enabledPlugins` ([distribution.md](distribution.md)).
3. **A version range has a tag to resolve against.** See below.

## Tags and version ranges

A dependency range such as `^1.2` resolves to the highest git tag named `<plugin>--v<version>` that satisfies it, on the repository that hosts the dependency. For a plugin with its own repository the plugin's author creates the tags. For a relative-path plugin like those in this repository, the marketplace repository is the host. `claude plugin tag --push`, run from the plugin directory, creates and pushes the tag after checking that `plugin.json` and the marketplace entry agree on the version, the working tree is clean and the tag does not exist. A dependent that pins a range on a plugin whose repository has no matching tag fails with `has no git tag satisfying <range>`. For a relative-path plugin it instead falls back to the marketplace's current copy and checks the range when the plugin loads.

This repository releases with tags `<plugin>--v<version>` for that reason. A `/` delimiter (`<plugin>/v<version>`) is valid for git and for the release tool, but `claude plugin tag` cannot create it and a dependent in another repository cannot resolve a range against it. The format is set in one place, the `tagFormat` option of the release configuration, and [releasing.md](releasing.md) says where. Switching to `/` is a one-line change that gives up cross-repository ranges.

Ranges do not match pre-release versions unless the range opts in, as in `^2.0.0-0`.
