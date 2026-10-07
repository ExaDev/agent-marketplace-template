# example-mcp

A minimal example of a plugin-provided MCP server. `.mcp.json` declares one stdio server, `echo`, which runs `servers/echo-server.mjs` through `${CLAUDE_PLUGIN_ROOT}`. The script has no dependencies, needs only Node.js, and exposes one tool, `echo`, which returns its `text` argument.

## Try it

```bash
claude --plugin-dir ./plugins/example-mcp
```

Run `/mcp` to see `plugin:example-mcp:echo`, then ask Claude to call the echo tool. To check the server without Claude Code, pipe JSON-RPC into it:

```bash
printf '%s\n' \
  '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"probe","version":"0"}}}' \
  '{"jsonrpc":"2.0","method":"notifications/initialized"}' \
  '{"jsonrpc":"2.0","id":2,"method":"tools/list"}' \
  | node plugins/example-mcp/servers/echo-server.mjs
```

## Content owner

The repository maintainers.
