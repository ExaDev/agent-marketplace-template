---
description: Remove a plugin from a marketplace checkout. Use when asked to delete or unlist a plugin from .claude-plugin/marketplace.json.
argument-hint: "<plugin-name>"
disable-model-invocation: true
---

Remove the plugin named in the arguments from the marketplace in the current checkout.

1. Read `.claude-plugin/marketplace.json` and find the entry with that `name`. If none exists, stop and report it.
2. Search the other plugins' `plugin.json` files for a `dependencies` entry naming it. If any exist, stop and report them, because removing the plugin would break them.
3. Delete the entry from the `plugins` array, keeping the formatting and order of the remaining entries.
4. Delete the `plugins/<name>/` directory. Use `git rm -r` when the checkout is a git repository so the removal is tracked; otherwise ask before deleting files.
5. Run the `validate-marketplace` skill and fix anything it reports before finishing.
