#!/bin/sh
# Opt-in SessionStart script. Does nothing unless EXAMPLE_HOOKS_INSTALL=1.
# Installs templates/starter-notes.md to <project>/.claude/example-hooks/starter-notes.md.
#
# Safety invariant: an existing file is replaced only when its SHA-256 equals
# the hash recorded when this script last wrote it (that is, the user has not
# touched it). A file that is missing from the record, or whose hash differs,
# is left alone.
[ "${EXAMPLE_HOOKS_INSTALL:-}" = "1" ] || exit 0

root=${CLAUDE_PLUGIN_ROOT:?}
data=${CLAUDE_PLUGIN_DATA:?}
project=${CLAUDE_PROJECT_DIR:-$PWD}
src=$root/templates/starter-notes.md
dest=$project/.claude/example-hooks/starter-notes.md
record=$data/starter-notes.sha256

hash_of() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" | cut -d' ' -f1
  else
    shasum -a 256 "$1" | cut -d' ' -f1
  fi
}

install_copy() {
  mkdir -p "$(dirname "$dest")" "$data" || exit 0
  cp "$src" "$dest" || exit 0
  hash_of "$dest" > "$record"
  echo "example-hooks: installed $dest"
}

if [ ! -e "$dest" ]; then
  install_copy
elif [ -f "$record" ] && [ "$(hash_of "$dest")" = "$(cat "$record")" ] \
  && [ "$(hash_of "$src")" != "$(cat "$record")" ]; then
  install_copy
fi
exit 0
