---
name: word-count
description: Counts the words, lines and characters in a text file using a bundled script. Use when asked how long a file or document is.
allowed-tools: Bash(python3 *)
---

Count the size of the file the user names.

1. Run `python3 "${CLAUDE_SKILL_DIR}/scripts/count.py" <path>` and read the three numbers it prints.
2. Report them to the user, one line each.
3. If the user asks what counts as a word, read [the counting rules](references/counting-rules.md) and answer from it.
