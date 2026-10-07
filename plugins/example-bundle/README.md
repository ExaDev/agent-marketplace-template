# example-bundle

Shows a bundle: a plugin whose manifest holds only `name`, `version`, `description` and a `dependencies` array. Installing it installs every dependency. Bare names and `{ name, version }` objects resolve in this plugin's own marketplace.

This one depends on `example-skills` and `example-commands`, each with the semver range `^0.1.0`. A range resolves against git tags named `<plugin-name>--v<version>` on the repository that hosts the dependency, so tag releases with `claude plugin tag`.

## Try it

Both dependencies must be loaded alongside the bundle:

```bash
claude --plugin-dir ./plugins/example-skills --plugin-dir ./plugins/example-commands --plugin-dir ./plugins/example-bundle
```

## Depending on another marketplace

Add `marketplace` to the object form:

```json
{ "name": "audit-logger", "marketplace": "your-shared-marketplace", "version": "^1.0" }
```

A string `"name@marketplace"` also works when no version constraint is needed. By default Claude Code refuses to install a dependency from a different marketplace. The root marketplace, the one hosting the plugin the user installs, must list the target in `allowCrossMarketplaceDependenciesOn` in its `.claude-plugin/marketplace.json`:

```json
{ "allowCrossMarketplaceDependenciesOn": ["your-shared-marketplace"] }
```

Only the root marketplace's allowlist applies, and a dependency the user already has enabled at the same scope bypasses the check.

## Content owner

The repository maintainers.
