# example-workflows

A minimal dynamic workflow.

## What it shows

A workflow script in `workflows/hello-workflow.js`. It starts with an `export const meta` object literal giving a `name` and `description`, then a script body that calls `agent()`. The manifest's `workflows` key points at the directory. Plugin workflows are namespaced by the plugin name.

## Try it

```bash
claude --plugin-dir ./plugins/example-workflows
```

Start a session with the command above and run `/example-workflows:hello-workflow`. Approve the run when prompted, and follow it with `/workflows`. Workflows must not be disabled in `/config`.

## Content owner

The repository maintainers.
