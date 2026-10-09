#!/bin/bash
# Scans files for details that must not leave this machine in a prompt meant for someone else: the user name, home directory, host name, git email, and token-shaped strings. Reports each hit as the file, the line numbers and what kind of detail it is, never the matching text, because a token in this script's output would land in the session transcript. Exits 1 if there are any hits, 0 if none, and 2 when it is misused or a file cannot be read (an unreadable file is never a pass). The user name and host name match as whole words, so a longer word that merely contains them is not a hit. Usage: leak-check.sh FILE...
set -euo pipefail

if [ $# -eq 0 ]; then
  echo "usage: leak-check.sh FILE..." >&2
  exit 2
fi

for file in "$@"; do
  if [ ! -f "$file" ] || [ ! -r "$file" ]; then
    echo "leak-check: cannot read $file" >&2
    exit 2
  fi
done

found=0

# scan FILE LABEL GREP_ARG...: reports the line numbers at which grep matches FILE, under LABEL.
scan() {
  local file="$1" label="$2" lines
  shift 2
  lines="$(grep -n "$@" -- "$file" | cut -d: -f1 | paste -sd, - || true)"
  if [ -n "$lines" ]; then
    echo "leak-check: $file line(s) $lines: $label" >&2
    found=1
  fi
}

user="${USER:-$(id -un)}"
host="$(hostname -s || true)"
email="$(git config --get user.email || true)"

for file in "$@"; do
  # An empty pattern would match every line, so a detail that is not set is skipped.
  [ -z "$user" ] || scan "$file" "user name \"$user\"" -F -i -w -e "$user"
  [ -z "$host" ] || scan "$file" "host name \"$host\"" -F -i -w -e "$host"
  [ -z "${HOME:-}" ] || scan "$file" "home directory \"$HOME\"" -F -i -e "$HOME"
  [ -z "$email" ] || scan "$file" "git email \"$email\"" -F -i -e "$email"
  # Prefixes of GitHub, npm, Slack, Anthropic, OpenAI and AWS credentials, and private key headers.
  scan "$file" "token-shaped string" -E -e '(gh[opsu]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|npm_[A-Za-z0-9]{20,}|xox[abprs]-[A-Za-z0-9-]{10,}|sk-ant-[A-Za-z0-9_-]{10,}|sk-[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY-----)'
done
exit "$found"
