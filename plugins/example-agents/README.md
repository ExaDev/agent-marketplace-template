# example-agents

Shows the agent component type. Each Markdown file under `agents/` defines one subagent, found by default, so the manifest needs no `agents` key. The frontmatter sets `name`, `description`, `tools` and `model`.

- `code-reviewer` is read-only.
- `docs-writer` may edit files.

## Try it

```bash
claude --plugin-dir ./plugins/example-agents
```

Run `/agents` to see them, or ask Claude to use `example-agents:code-reviewer` on a change. Plugin agents are namespaced as `<plugin>:<name>`.

## Content owner

The repository maintainers.
