#!/bin/bash
# Scans files for details that must not leave this machine in a prompt meant for someone else: the user name, home directory, host name, git email, and token-shaped strings. Prints each hit with its file and line and exits 1 if there are any, 0 if none. Usage: leak-check.sh FILE...
set -euo pipefail

if [ $# -eq 0 ]; then
  echo "usage: leak-check.sh FILE..." >&2
  exit 2
fi

patterns=()
patterns+=("$USER")
patterns+=("$HOME")
patterns+=("$(hostname -s)")
email="$(git config --get user.email || true)"
[ -n "$email" ] && patterns+=("$email")

status_code=0
for file in "$@"; do
  for pattern in "${patterns[@]}"; do
    if grep -n -F -i -- "$pattern" "$file"; then
      echo "leak-check: $file contains \"$pattern\"" >&2
      status_code=1
    fi
  done
  # Prefixes of GitHub, npm, Slack, Anthropic, OpenAI and AWS credentials, and private key headers.
  if grep -n -E -- '(gh[opsu]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|npm_[A-Za-z0-9]{20,}|xox[abprs]-[A-Za-z0-9-]{10,}|sk-ant-[A-Za-z0-9_-]{10,}|sk-[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY-----)' "$file"; then
    echo "leak-check: $file contains a token-shaped string" >&2
    status_code=1
  fi
done
exit "$status_code"
