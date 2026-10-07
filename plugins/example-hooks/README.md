# example-hooks

A minimal example of plugin hooks. It shows the `hooks/hooks.json` format (the event map sits under a top-level `hooks` key), `${CLAUDE_PLUGIN_ROOT}` for script paths, and two dependency-free POSIX shell scripts.

- `PreToolUse` on `Bash`: `scripts/guard-bash.sh` blocks a recursive `rm` aimed at `/`, `~` or `$HOME` (exit code 2) and allows everything else.
- `SessionStart` on `startup`: `scripts/install-starter.sh` is opt-in. With `EXAMPLE_HOOKS_INSTALL=1` it copies `templates/starter-notes.md` into `.claude/example-hooks/` in the project. It records the SHA-256 of what it wrote in `${CLAUDE_PLUGIN_DATA}`, and only replaces a file whose hash still matches that record. A file you created or edited is never overwritten.

## Try it

```bash
claude --plugin-dir ./plugins/example-hooks
# opt in to the installer
EXAMPLE_HOOKS_INSTALL=1 claude --plugin-dir ./plugins/example-hooks
```

Ask Claude to run `rm -rf ~` and the hook denies it.

## Content owner

The repository maintainers.
