#!/bin/bash
# Publish a setup-prompt file as a secret GitHub gist, updating the gist for the same use case if one already exists, and print its URL.
#
# Usage: share-gist.sh FILE SLUG
#
# SLUG names the use case (the piece, or the sorted piece names joined by "+"), so a re-run for the same pieces finds the gist it made before. The gist is identified by its description, `Setup prompt: SLUG`, and its file name, `SLUG-setup-prompt.md`, among the authenticated user's own secret gists. Found: the file's contents replace the gist's file. Not found: a new secret gist is created. Refuses (exit 2) when leak-check.sh finds anything in FILE, because a gist link can be forwarded to anyone. Needs `gh` logged in with the gist scope.
set -euo pipefail

file="${1:-}"; slug="${2:-}"
[ -f "$file" ] && [ -n "$slug" ] || { echo "usage: share-gist.sh FILE SLUG" >&2; exit 2; }
here="$(dirname "$0")"

"$here/leak-check.sh" "$file" >&2 || { echo "refusing: leak-check.sh found something in $file; fix it before sharing" >&2; exit 2; }

description="Setup prompt: $slug"
name="$slug-setup-prompt.md"

# `gh api gists` lists the authenticated user's gists, secret ones included (public is false for them). Take the first match: a use case has one gist.
id=$(gh api --paginate gists --jq ".[] | select(.public == false and .description == \"$description\" and (.files | has(\"$name\"))) | .id" | head -n 1)

if [ -n "$id" ]; then
  gh gist edit "$id" --filename "$name" "$file" >&2
  echo "updated https://gist.github.com/$id" >&2
else
  # Secret is the default for gh gist create; --public is the only flag that changes it, and there is no --secret flag. --filename only names a file read from stdin; given a path, gh would use the path's own name and the next run would not find the gist.
  gh gist create - --filename "$name" --desc "$description" < "$file"
  exit 0
fi
echo "https://gist.github.com/$id"
