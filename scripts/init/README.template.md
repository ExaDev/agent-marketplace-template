# {{title}}

<!-- content:claude:start -->
A Claude Code plugin marketplace for {{owner}}.
<!-- content:claude:end -->
<!-- content:skills:start -->
Agent skills maintained by {{owner}}.
<!-- content:skills:end -->

## Installing

<!-- content:claude:start -->
```text
/plugin marketplace add {{repository}}
/plugin install <plugin>@{{marketplace}}
```

The marketplace name is the `name` in `.claude-plugin/marketplace.json`, which can differ from the repository name. The plugins are listed below.
<!-- content:claude:end -->
<!-- content:skills:start -->
To install the skills with the `skills` CLI, run `npx skills add {{repository}}`.
<!-- content:skills:end -->

## Plugins

<!-- plugins:start -->
<!-- plugins:end -->

## Layout

<!-- content:claude:start -->
- `.claude-plugin/marketplace.json`: the catalogue, one entry per plugin
- `plugins/<name>/`: one pnpm workspace package per plugin
<!-- content:claude:end -->
- `{{skillsPath}}`: one directory per skill
- `scripts/`: checks and the README table
- `.github/workflows/`: CI and the merge-when-green workflow
- `docs/`: contributor documentation

## Commands

| Command | Purpose |
| --- | --- |
| `pnpm run validate` | Everything CI runs on a pull request apart from commit linting |
| `pnpm run typecheck` | Type-check the scripts |
| `pnpm run lint` | Lint the scripts, JSON, Markdown and every `SKILL.md` with the shared ESLint config |
| `pnpm run lint:fix` | The same, applying the fixes |
| `pnpm run test` | Run the script tests |
| `pnpm run check:skills` | Every skill sits where the `skills` CLI finds it |
<!-- content:claude:start -->
| `pnpm run check:versions` | Each plugin's `package.json` carries a version and is named for its directory |
<!-- content:claude:end -->
| `pnpm run check:readme` | The table above is up to date |
| `pnpm run readme` | Regenerate the table above |
<!-- content:claude:start -->
| `pnpm run release` | Release changed plugins (CI runs this on `main`) |
<!-- content:claude:end -->

## Documentation

- [CONTRIBUTING.md](CONTRIBUTING.md)
<!-- content:claude:start -->
- [docs/authoring.md](docs/authoring.md)
- [docs/distribution.md](docs/distribution.md)
- [docs/cross-marketplace.md](docs/cross-marketplace.md)
- [docs/releasing.md](docs/releasing.md)
<!-- content:claude:end -->
<!-- content:skills:start -->
- [docs/skills-cli.md](docs/skills-cli.md)
<!-- content:skills:end -->
- [docs/rulesets.md](docs/rulesets.md)
- [docs/private-repo-auth.md](docs/private-repo-auth.md)

## Licence

{{licence}}
