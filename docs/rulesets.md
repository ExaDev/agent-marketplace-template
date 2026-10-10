# Protecting `main` with a ruleset

This repository ships no ruleset and no secrets, because both are settings on a particular repository. This page is a recipe to apply deliberately, once the repository exists.

## Availability

Rulesets are available on public repositories and on private repositories on a paid plan. On a private repository on the Free plan the API refuses with "Upgrade to GitHub Pro or make this repository public", and organisation-level rulesets need GitHub Team or Enterprise. Without a ruleset the checks below still run on every pull request but nothing forces them, and the release job simply pushes to `main` with its token and needs no bypass. Enforcement is then a team habit, not a control. [Merging a labelled pull request](#merging-a-labelled-pull-request) saves the manual merge there.

## What it enforces

- Pull requests are required, and only a rebase merge is allowed, so history stays linear and every commit on `main` is one the release tool can read.
- The status checks `validate`, `commitlint` and `ci-skip-guard` must pass, against an up-to-date branch. They are the job names in `.github/workflows/ci.yml` and `.github/workflows/ci-skip-guard.yml`. The workflows have no path filter so these checks always report.
- `main` cannot be deleted or force-pushed.
<!-- content:claude:start -->
- The identity that runs the release job can push to `main` directly, because the release tool commits and tags itself and does not open a pull request ([releasing.md](releasing.md)).
<!-- content:claude:end -->

## The ruleset

Replace `123456` with the numeric ID of the GitHub App that holds the release token, then apply it:

```bash
gh api --method POST repos/<owner>/<repo>/rulesets --input ruleset.json
```

```json
{
  "name": "main",
  "target": "branch",
  "enforcement": "active",
  "conditions": {
    "ref_name": { "include": ["~DEFAULT_BRANCH"], "exclude": [] }
  },
  "bypass_actors": [
    { "actor_id": 123456, "actor_type": "Integration", "bypass_mode": "always" }
  ],
  "rules": [
    { "type": "deletion" },
    { "type": "non_fast_forward" },
    { "type": "required_linear_history" },
    {
      "type": "pull_request",
      "parameters": {
        "required_approving_review_count": 1,
        "dismiss_stale_reviews_on_push": true,
        "require_code_owner_review": false,
        "require_last_push_approval": false,
        "required_review_thread_resolution": true,
        "allowed_merge_methods": ["rebase"]
      }
    },
    {
      "type": "required_status_checks",
      "parameters": {
        "strict_required_status_checks_policy": true,
        "required_status_checks": [
          { "context": "validate" },
          { "context": "commitlint" },
          { "context": "ci-skip-guard" }
        ]
      }
    }
  ]
}
```

The field names are from GitHub's [repository rules API](https://docs.github.com/en/rest/repos/rules).

## The bypass actor

The release job pushes straight to `main`, and `bypass_mode` must be `always` for a direct push to bypass the pull request rule (`pull_request` mode only lets the actor bypass through a pull request). The actor types the API accepts are `Integration` (a GitHub App), `OrganizationAdmin`, `RepositoryRole`, `Team`, `DeployKey` and `User`. Prefer a GitHub App: install it on the repository with contents write, mint an installation token in the release workflow or store one as the `RELEASE_TOKEN` secret, and list the App as the `Integration` actor. A deploy key with write access, listed as a `DeployKey` actor, is the fallback.

The `github-actions` identity behind the workflow's own `GITHUB_TOKEN` cannot be a bypass actor: the API answers `Actor GitHub Actions integration must be part of the ruleset source or owner organization`. With only that token, the release job's push is rejected with `GH013: Repository rule violations found` (`Changes must be made through a pull request` and the required status checks), so a repository with this ruleset must supply a different identity in `RELEASE_TOKEN`: an installation token of a GitHub App owned by the organisation or user that owns the repository, or a token belonging to an administrator when `OrganizationAdmin` or a `RepositoryRole` is the bypass actor. Without any bypass actor, a direct push is rejected for administrators too.

Keep the bypass narrow. Humans are not bypass actors, and a bypass actor should hold only the permission the release needs. Check that the bypass works with a real release on a throwaway repository, not by reading the JSON.

## Review settings to decide

One approving review is a starting point. If review is required, also decide whether a bot approval should count and whether `require_code_owner_review` applies, and note that automated reviewers comment again on every push. `required_review_thread_resolution` makes unresolved review threads block the merge.

## Merging a labelled pull request

Where neither a ruleset nor auto-merge is available, `.github/workflows/merge-when-green.yml` runs [`ExaDev/merge-when`](https://github.com/ExaDev/merge-when) with the conditions of [`ExaDev/merge-when-green`](https://github.com/ExaDev/merge-when-green) written out. The wrapper is not used, because it calls the inner action by a moving tag, which a pin on the wrapper would not cover; the inner action is pinned by commit, and its own nested action is pinned by commit too. A pull request labelled `automerge` is rebase merged once the `Required checks` job in `ci` has passed on its current head commit, it is not a draft and no review thread is unresolved. The job aggregates `validate` and, on pull requests, `commitlint`, so the workflow names one check and a new job is added to that job's `needs` list. `ci` has no path filter, which is what stops a required check from never reporting and leaving the pull request waiting.

### The merge uses the workflow token

The merge is made with the workflow token and nothing else, so GitHub holds it to the repository's rulesets at the moment of the merge: required reviews, up-to-date branches, required checks and a merge queue are enforced there, atomically, and none of it is repeated in the workflow. A repository whose ruleset requires a review or lists a bypass actor will refuse the merge, and that pull request is merged by hand. There is no supported override with a more powerful token: an optional privileged merge path was the source of every security finding this workflow has had, because each defence for it (independent approvals, an admin shortcut, a default-branch restriction, re-reading reviews, a fresh base) was a second implementation of what the ruleset already does, with a gap at the edge. Create the `automerge` label in the repository before using it.

### What the label means

The label is an authorisation to merge one head commit into one base branch, given by one person with write access: the head that person saw, the base it was targeting, and their own access. Triage is enough to apply a label but not to authorise a merge, and a pull request from a fork is never authorised, because its checks and its workflow files are the author's; merge it by hand after reading it. Rulesets do not encode this intent, which is why it is kept.

Applying the label runs the `authorise` job, which records the authorisation as its own name (the pull request, head commit, person and base) and a `merge-when-green/authorised` commit status that points at the run. The status is only a pointer: a workflow in a pull request can post statuses as `github-actions[bot]`, so it is never trusted. Before the action runs, the `merge` job accepts a labelled pull request only when a successful `authorise` job exists whose name matches the current head commit, the current base and the person who applied the label last (read from the timeline, which pull request code cannot write as another user), that person still has write access, and the run is a `pull_request_target` run of `merge-when-green.yml` at a commit in the base branch's history. The action reads the label itself a few seconds after that check, so the verifying step also records a check run named for the workflow run, and the action requires it: a pull request labelled after the verification has no such check and is left until its own run. The action then merges only the commit it checked (`gh pr merge --match-head-commit`), and re-checks the label, draft state, required check and unresolved threads immediately before.

What invalidates an authorisation: a push (new head commit), a change of the base branch, someone else applying the label afterwards, lost write access for the person who applied it, and closing and reopening or converting to draft. The `revoke` job also removes the label on a push, a base change, a reopen and a conversion to draft, so the pull request visibly needs authorising again; the control is the binding above, and the removal is the visible reset, because a base edit sends no push event. A maintainer applies the label again after reading what is now there. The title and description are never read, and the `Required checks` result comes from the pull request's own workflow files, bound to the head, which is why the reviewer reads the diff, `.github/` included, before labelling.

No job runs pull request code: the `merge` job fetches only `.github/scripts` from the default branch, and every value taken from the event reaches a shell through an environment variable, which is what makes the `pull_request_target` trigger safe here. The workflow token's permissions are limited per job: write on commit statuses and pull requests for `authorise`, pull requests for `revoke`, and write on contents, pull requests and actions for `merge`.

### After a merge

GitHub does not start workflows from a push made with the workflow token, so once a merge has happened the workflow dispatches `ci` on the default branch, which runs `validate`.
<!-- content:claude:start -->

The dispatched run also starts the `release` job for the merged commits; the `release` job accepts a dispatch on the default branch as well as a push.
<!-- content:claude:end -->
