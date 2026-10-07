---
name: add-plugin
description: Add a plugin to a marketplace checkout. Use when asked to register a plugin directory under plugins/ in .claude-plugin/marketplace.json.
argument-hint: "<plugin-name>"
---

Add the plugin named in the arguments to the marketplace in the current checkout.

1. Confirm `plugins/<name>/.claude-plugin/plugin.json` exists and that its `name` equals `<name>`. If either is missing, stop and say what is missing.
2. Read `.claude-plugin/marketplace.json`. If an entry with that `name` already exists, stop and report it rather than adding a duplicate.
3. Append one entry to the `plugins` array, copying `description` from the plugin's own `plugin.json`:

   ```json
   {
     "name": "<name>",
     "source": "./plugins/<name>",
     "description": "<description from plugin.json>"
   }
   ```

   Rules for every entry:
   - `source` is the relative path `./plugins/<name>`, resolved from the marketplace root.
   - Never add a `version` to an entry. The plugin's own `plugin.json` is the single source of the version.
   - Never add a `skills` key. Skills are discovered from the plugin directory.
4. Keep the file's existing formatting and the order of the other entries.
5. Run the `validate-marketplace` skill and fix anything it reports before finishing.
