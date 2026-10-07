#!/bin/sh
# PreToolUse guard for the Bash tool. Reads the hook payload (JSON) from stdin
# and exits 2 (block, reason on stderr) when the command is a recursive
# `rm` aimed at the filesystem root or the home directory. Any other input
# exits 0, leaving the normal permission flow untouched. It only reads stdin
# and never executes or modifies anything.
input=$(cat)

if printf '%s' "$input" | grep -Eq 'rm[[:space:]]+-[a-zA-Z]*[rR][a-zA-Z]*[[:space:]]+(/|~|\$HOME)([[:space:]"\\]|$)'; then
  echo "Blocked by example-hooks: recursive rm of / or the home directory." >&2
  exit 2
fi

exit 0
