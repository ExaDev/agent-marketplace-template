# example-settings

A minimal set of plugin default settings.

## What it shows

A `settings.json` at the plugin root. Only the `agent` and `subagentStatusLine` keys take effect while the plugin is enabled, and the user's own settings override them. Here `agent` selects the plugin's own `greeter` agent (defined in `agents/greeter.md`) as the main-thread agent.

## Try it

```bash
claude --plugin-dir ./plugins/example-settings
```

Start a session with the command above. The main conversation answers with the greeter agent's system prompt and model.

## Content owner

The repository maintainers.
