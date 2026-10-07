# example-output-styles

A minimal example of a plugin-provided output style. `output-styles/plain-first.md` is a Markdown file with `name`, `description` and `keep-coding-instructions` frontmatter followed by the style's instructions. Claude Code scans `output-styles/` by default, so no manifest field is needed.

## Try it

```bash
claude --plugin-dir ./plugins/example-output-styles
```

Run `/output-style` to list the styles and select "Plain first". Add `force-for-plugin: true` to the frontmatter to apply a style automatically whenever the plugin is enabled.

## Content owner

The repository maintainers.
