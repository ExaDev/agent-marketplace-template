---
name: validate-marketplace
description: Validate a marketplace checkout and every plugin in it. Use before committing marketplace changes or when asked whether the marketplace is valid.
---

Validate the marketplace in the current checkout.

1. Run `claude plugin validate . --strict` from the marketplace root. This checks `.claude-plugin/marketplace.json`, including every entry's `source`.
2. For each directory under `plugins/`, run `claude plugin validate plugins/<name> --strict`.
3. Check each entry in `.claude-plugin/marketplace.json` by hand for the conventions the validator does not enforce:
   - `source` is `./plugins/<name>` and the directory exists.
   - The entry has no `version` key.
   - The entry has no `skills` key.
   - Every directory under `plugins/` has an entry, and every entry has a directory.
4. Report each failure with the file and the message. Fix failures that are mechanical (for example a stray `version` key) and ask before changing a plugin's content.
5. Re-run the failing command after each fix until it passes cleanly.
