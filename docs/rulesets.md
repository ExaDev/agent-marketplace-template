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

Where neither a ruleset nor auto-merge is available, `.github/workflows/merge-when-green.yml` runs [`ExaDev/merge-when-green`](https://github.com/ExaDev/merge-when-green). A pull request labelled `automerge` is rebase merged once the `Required checks` job in `ci` has passed on its current head commit, it is not a draft and no review thread is unresolved. The job aggregates `validate` and, on pull requests, `commitlint`, so the workflow names one check and a new job is added to that job's `needs` list. `ci` has no path filter, which is what stops a required check from never reporting and leaving the pull request waiting.

### Who can authorise a merge

The label is an authorisation to merge one commit, the head the person who applied it saw. Applying it runs the `authorise` job, which accepts the label only from someone with write access to the repository (triage is enough to apply a label but not to authorise a merge) on a pull request from a branch of this repository, and then records a `merge-when-green/authorised` commit status on that head commit. A pull request from a fork is never authorised, because its checks and its workflow files are the author's; merge it by hand after reading it. Before the action runs, the `merge` job refuses to continue for a labelled pull request whose head commit has no such status, and the action itself merges only the commit it checked (`gh pr merge --match-head-commit`).

Anything that changes the head commit therefore invalidates the authorisation. The status belongs to a commit, so a commit pushed after the label has none, and the `revoke` job also removes the label on every push so the pull request shows that it needs authorising again. A maintainer applies the label again to the new head after reading it. Applying the label to a head that moved between the click and the job is refused for the same reason. The `Required checks` result is produced by the pull request's own workflow files, which is why a maintainer reads the diff, including anything under `.github/`, before labelling.

None of these jobs checks out or runs pull request code, and every value taken from the event reaches a shell through an environment variable, which is what makes the `pull_request_target` trigger safe here. The workflow token's permissions are limited per job: write on commit statuses and pull requests for the `authorise` and `revoke` jobs, and write on contents, pull requests and actions for the `merge` job.

### The merge and the secret

Labelling a pull request that is already green and authorised merges it at once, because the workflow also runs when the label is added or the pull request leaves draft. Merging by hand still works, and a repository that has a ruleset and auto-merge can delete the workflow.

The merge is made with the workflow token, which the job grants contents and pull requests write, so no secret is needed. GitHub does not start workflows from a push made with that token, so once a merge has happened the workflow dispatches `ci` on the default branch, which runs `validate`.
<!-- content:claude:start -->

The dispatched run also starts the `release` job for the merged commits; the `release` job accepts a dispatch on the default branch as well as a push.
<!-- content:claude:end -->

The `MERGE_TOKEN` repository secret is an optional override, for a repository whose ruleset only lets a bypass identity merge: a fine-grained personal access token or a GitHub App installation token with contents and pull requests write. A merge made with it starts `ci` through the push itself, so the workflow does not dispatch. The workflow token may be refused a merge that changes files under `.github/workflows`; merge those by hand or with the secret. Create the `automerge` label in the repository before using it.
