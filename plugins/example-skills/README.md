# example-skills

Shows the skill component type. It holds two skills under `skills/`, which Claude Code finds by default, so the manifest needs no `skills` key.

- `word-count` has frontmatter (`name`, `description`, `allowed-tools`), a `references/` file loaded on demand, and a small Python script in `scripts/`.
- `house-style` reads a file shared across skills (`shared/style-guide.md`) through a relative path from the skill's own directory.

## Try it

```bash
claude --plugin-dir ./plugins/example-skills
```

Then run `/example-skills:word-count README.md` or `/example-skills:house-style`, or ask Claude to count the words in a file.

## Content owner

The repository maintainers.
