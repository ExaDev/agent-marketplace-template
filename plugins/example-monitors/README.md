# example-monitors

A minimal background monitor.

## What it shows

A plugin monitor declared in `monitors/monitors.json` and referenced from the manifest's `experimental.monitors` key. The monitor runs `scripts/heartbeat.sh` for the session, and each line it prints reaches Claude as a notification. Monitors are experimental, start only in interactive sessions, and the command may use `${CLAUDE_PLUGIN_ROOT}` but never `${user_config.*}`.

## Try it

```bash
claude --plugin-dir ./plugins/example-monitors
```

Start an interactive session with the command above. The `example-heartbeat` monitor starts with the session and its output appears as notifications.

## Content owner

The repository maintainers.
