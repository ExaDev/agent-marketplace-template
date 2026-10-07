# example-bin

A minimal plugin executable.

## What it shows

An executable in `bin/`. While the plugin is enabled, files in `bin/` are on the Bash tool's `PATH`, so Claude can run them as bare commands. No manifest key is needed. The file must have its executable bit set.

## Try it

```bash
claude --plugin-dir ./plugins/example-bin
```

Start a session with the command above and ask Claude to run `example-hello`. The Bash tool result shows the script's output.

## Content owner

The repository maintainers.
