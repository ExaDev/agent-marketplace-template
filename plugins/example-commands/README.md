# example-commands

Shows the command component type: one flat Markdown file under `commands/`, found by default, so the manifest needs no `commands` key. The frontmatter sets `description`, `argument-hint` and `allowed-tools`, and the body uses `$ARGUMENTS`.

Commands are the older format; skills supersede them for new work. See `example-skills`.

## Try it

```bash
claude --plugin-dir ./plugins/example-commands
```

Then run `/example-commands:explain src/index.ts`.

## Content owner

The repository maintainers.
