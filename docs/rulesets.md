# Protecting `main` with a ruleset

The template ships no ruleset and no secrets, because both are settings on a particular repository. This page is a recipe to apply deliberately, once the repository exists.

## Availability

Rulesets are available on public repositories and on private repositories on a paid plan. On a private repository on the Free plan the API refuses with "Upgrade to GitHub Pro or make this repository public", and organisation-level rulesets need GitHub Team or Enterprise. Without a ruleset the checks below still run on every pull request but nothing forces them, and the release job simply pushes to `main` with its token and needs no bypass. Enforcement is then a team habit, not a control.

## What it enforces

- Pull requests are required, and only a rebase merge is allowed, so history stays linear and every commit on `main` is one the release tool can read.
- The status checks `validate`, `commitlint` and `ci-skip-guard` must pass, against an up-to-date branch. They are the job names in `.github/workflows/validate.yml` and `.github/workflows/ci-skip-guard.yml`. The workflows have no path filter so these checks always report.
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

Keep the bypass narrow. Humans are not bypass actors, and a bypass actor should hold only the permission the release needs. Check that the bypass works with a real release on a throwaway repository, not by reading the JSON.

## Review settings to decide

One approving review is a starting point. If review is required, also decide whether a bot approval should count and whether `require_code_owner_review` applies, and note that automated reviewers comment again on every push. `required_review_thread_resolution` makes unresolved review threads block the merge.
