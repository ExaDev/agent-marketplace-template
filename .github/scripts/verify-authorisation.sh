#!/usr/bin/env bash
# Decides whether the head commit of a labelled pull request was authorised by a run of this repository's merge-when-green workflow, for the pull request's current base, by the person who applied the label last. It fails with an error annotation otherwise.
#
# The authorisation is the successful `authorise` job of a merge-when-green run, whose job name is built from the pull request number, the head commit, the person who applied the label and the base branch. A commit status only points at that run: a workflow in a pull request can post statuses as github-actions[bot], so the status is never trusted, and the run is accepted only when it is a pull_request_target run of .github/workflows/merge-when-green.yml for this pull request and head, whose workflow file came from a commit that is part of the base branch's history, which a pull request cannot add to without review. The run's own head_sha is the pull request's head commit, which its author controls, so the commit the workflow was read from is the base.sha that GitHub records for the pull request in the run's pull_requests list.
#
# Inputs (environment):
#   GH_TOKEN             reads pull requests, timelines, statuses, runs and commits
#   GITHUB_REPOSITORY    owner/name
#   NUMBER               the pull request number
#   HEAD_SHA             the commit the triggering event is about
#   LABEL                the opt-in label
#   AUTHORISED_CONTEXT   the commit status context the authorise job posts
#
# The workflow runs this from a checkout of the default branch, never from the pull request.
set -euo pipefail

: "${GITHUB_REPOSITORY:?}" "${NUMBER:?}" "${HEAD_SHA:?}" "${LABEL:?}" "${AUTHORISED_CONTEXT:?}"

fail() {
  echo "::error::Pull request ${NUMBER} is labelled but ${HEAD_SHA} is not authorised: $1; remove the label and apply it again to the commit you reviewed."
  exit 1
}

pr=$(gh pr view "$NUMBER" --repo "$GITHUB_REPOSITORY" --json headRefOid,baseRefName)
if [ "$(jq -r .headRefOid <<<"$pr")" != "$HEAD_SHA" ]; then
  echo "Pull request ${NUMBER} has moved on from ${HEAD_SHA}; its own run decides."
  exit 0
fi
base=$(jq -r .baseRefName <<<"$pr")

# The last person to apply the label, from the timeline, which pull request code cannot write as another user.
labeller=$(gh api --paginate --slurp "repos/${GITHUB_REPOSITORY}/issues/${NUMBER}/timeline" \
  | jq -r --arg label "$LABEL" '[.[][] | select(.event == "labeled" and .label.name == $label)] | last | .actor.login // empty')
[ -n "$labeller" ] || fail "nobody is recorded as having applied the label"

# Write access is checked again, because it can be withdrawn after the label was applied.
[ "$(gh api "repos/${GITHUB_REPOSITORY}/collaborators/${labeller}/permission" | jq -r .user.permissions.push)" = true ] || fail "${labeller} no longer has write access"

expected="authorise #${NUMBER} sha=${HEAD_SHA} by=${labeller} base=${base}"

run_ids=$(gh api "repos/${GITHUB_REPOSITORY}/commits/${HEAD_SHA}/statuses?per_page=100" \
  | jq -r --arg context "$AUTHORISED_CONTEXT" '.[] | select(.context == $context and .state == "success") | .target_url // empty' \
  | sed -n 's|.*/actions/runs/\([0-9][0-9]*\).*|\1|p' | sort -u)

for id in $run_ids; do
  run=$(gh api "repos/${GITHUB_REPOSITORY}/actions/runs/${id}")
  [ "$(jq -r '.event == "pull_request_target" and (.path | startswith(".github/workflows/merge-when-green.yml"))' <<<"$run")" = true ] || continue
  run_sha=$(jq -r --argjson number "$NUMBER" --arg head "$HEAD_SHA" '[.pull_requests[]? | select(.number == $number and .head.sha == $head)] | first | .base.sha // empty' <<<"$run")
  [ -n "$run_sha" ] || continue
  relation=$(gh api "repos/${GITHUB_REPOSITORY}/compare/${run_sha}...${base}" | jq -r .status)
  case "$relation" in identical | ahead) ;; *) continue ;; esac
  if [ "$(gh api "repos/${GITHUB_REPOSITORY}/actions/runs/${id}/jobs?per_page=100" | jq -r --arg name "$expected" 'any(.jobs[]; .name == $name and .conclusion == "success")')" = true ]; then
    exit 0
  fi
done
fail "no successful authorise run for ${labeller} on this head and the base ${base}"
