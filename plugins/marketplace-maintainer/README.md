# marketplace-maintainer

Skills for maintaining a plugin marketplace.

## What it shows

Three skills that act on a marketplace checkout: `add-plugin` registers a directory under `plugins/` in `.claude-plugin/marketplace.json`, `validate-marketplace` runs `claude plugin validate --strict` on the marketplace and each plugin, and `remove-plugin` unlists and deletes a plugin. Entries use `"source": "./plugins/<name>"`, never carry a `version` and never a `skills` key.

## Try it

```bash
claude --plugin-dir ./plugins/marketplace-maintainer
```

Start a session in a marketplace checkout with the command above, then run `/marketplace-maintainer:validate-marketplace`, `/marketplace-maintainer:add-plugin <name>` or `/marketplace-maintainer:remove-plugin <name>`.

## Content owner

The repository maintainers.
