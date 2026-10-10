#!/usr/bin/env bash
# Decides whether a merge made by a token that can bypass required review is justified for a pull request. It succeeds when the person who applied the label is an admin, who can bypass the ruleset by hand anyway, or when the head commit has an approval from someone with write access other than the pull request's author and no reviewer's latest review requests changes. Approvals of an earlier head do not count. It fails with an error annotation otherwise.
#
# Inputs (environment):
#   GH_TOKEN             reads the pull request, its reviews and collaborator permissions
#   GITHUB_REPOSITORY    owner/name
#   NUMBER               the pull request number
#   HEAD_SHA             the head commit that would be merged
#   LABELLER             login of the person who applied the label
#
# The workflows run this from a checkout of the default branch, never from the pull request.
set -euo pipefail

: "${GITHUB_REPOSITORY:?}" "${NUMBER:?}" "${HEAD_SHA:?}" "${LABELLER:?}"

permission=$(gh api "repos/${GITHUB_REPOSITORY}/collaborators/${LABELLER}/permission")
if [ "$(jq -r .user.permissions.admin <<<"$permission")" = true ]; then
  exit 0
fi

# shellcheck disable=SC2016 # $owner, $name and $number are GraphQL variables, not shell ones.
reviews=$(gh api graphql -F owner="${GITHUB_REPOSITORY%/*}" -F name="${GITHUB_REPOSITORY#*/}" -F number="$NUMBER" -f query='
  query($owner: String!, $name: String!, $number: Int!) {
    repository(owner: $owner, name: $name) {
      pullRequest(number: $number) {
        author { login }
        latestOpinionatedReviews(first: 100) { nodes { state author { login } commit { oid } } }
      }
    }
  }')

# The latest opinionated review of each reviewer decides, and a change request from any reviewer blocks.
approvers=$(jq -r --arg head "$HEAD_SHA" '
  .data.repository.pullRequest as $pr
  | if any($pr.latestOpinionatedReviews.nodes[]; .state == "CHANGES_REQUESTED") then empty
    else $pr.latestOpinionatedReviews.nodes[]
      | select(.state == "APPROVED" and .commit.oid == $head and .author.login != $pr.author.login)
      | .author.login
    end' <<<"$reviews")

for approver in $approvers; do
  if [ "$(gh api "repos/${GITHUB_REPOSITORY}/collaborators/${approver}/permission" --jq .user.permissions.push)" = true ]; then
    exit 0
  fi
done

echo "::error::The merge token can bypass required review, so ${HEAD_SHA} needs an approval from someone with write access other than its author, with no change requested, or the label applied by an admin."
exit 1
