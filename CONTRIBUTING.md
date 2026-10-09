# Contributing

This repository is a plugin marketplace. A change is usually a new plugin, a change to an existing one, or a change to the tooling and docs around them. Everything goes through a pull request and is checked by CI before it reaches `main`.

## If Git is new to you

A few words come up constantly.

- A repository is the project folder plus its history.
- A commit is one saved change with a message. The history is a chain of commits.
- A branch is a named line of commits. `main` is the shared one, and you never work on it directly.
- A pull request asks for your branch to be merged into `main`. Reviewers and CI look at it first.
- Staging means choosing which changes go into the next commit.
- A rebase replays your commits on top of the latest `main`, so the history stays a straight line.

The steps below are the whole loop. Run them in order and the vocabulary will stick.

1. Fork the repository on GitHub if you have no write access, otherwise skip this. Clone it and install the tooling with `pnpm install`.
2. Update `main` and branch from it: `git switch main`, `git pull`, `git switch -c feat/my-change`.
3. Make the change, then run `pnpm run validate`. It runs the checks CI runs: type-check, lint, the tests, the skills and version checks, the README table and plugin validation.
4. Look at what you changed with `git status` and `git diff`.
5. Stage files by name and commit (see below).
6. Push the branch and open a pull request. `gh pr create --draft` opens it as a draft, which is right while CI is still running.
7. When CI is green and you are done, mark it ready for review. Answer every review comment, either with a fix or a reply.
8. Once approved, the pull request is merged with a rebase merge. Your commits land on `main` one by one, unchanged apart from being re-applied. Add the `automerge` label to have the `merge-when-green` workflow do it for you as soon as the `Required checks` job has passed, the pull request is not a draft and every review thread is resolved ([docs/rulesets.md](docs/rulesets.md#merging-a-labelled-pull-request)).

## Using Claude Code to make the change

Start in plan mode (`Shift+Tab` until the mode reads plan, or `claude --permission-mode plan`). In plan mode Claude reads the repository and proposes a plan without editing anything, so you can correct the approach before any file changes. Approve the plan, let Claude implement it, then read the diff yourself before committing. The `marketplace-maintainer` plugin in this repository has skills for adding, validating and removing plugins, and the project settings in `.claude/settings.json` stop Claude running the staging and hook-bypass commands described next.

## Staging and commits

Stage by name, and never stage everything:

```bash
git status
git add plugins/example-skills/skills/word-count/SKILL.md
git diff --cached
git commit
```

`git add -A` and `git add .` pick up whatever is lying around, including files you did not mean to share. `git diff --cached` shows exactly what the commit will contain, and a commit takes everything staged, not just the file you last added, so read it before committing. If you stage something by mistake, `git restore --staged <file>` unstages it and leaves your edits alone.

Make one commit per logical change. Do not bypass the commit hook with `--no-verify`: when it fails, read the message and fix the cause.

### Commit messages

Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/), because the release tool reads them to decide which plugins get a new version and how far to bump it.

```text
feat(example-skills): add a skill that lists TODO comments

The skill scans the files the user names and groups comments by file.
```

- The format is `type(scope): subject`. The types are the ones listed in `commit-types.ts`: `feat` makes a minor release, `fix` a patch, and a breaking change (`!` after the type or a `BREAKING CHANGE:` footer) a major one.
- The scope is the name of the plugin you changed. For a change that belongs to no plugin, use one of the fixed scopes in `commit-types.ts` (`ci`, `docs`, `repo`, and the `deps` and `release` scopes the release tooling writes), or leave the scope off.
- The subject says what the code now does, in the imperative. It does not describe the process ("address review comments").
- Body lines wrap at 100 columns. The body explains why, when the subject is not enough.
- Keep prose simple and written for the next reader. Do not put CI skip tokens in a message: the `ci-skip-guard` check fails a pull request that does.

`pnpm run lint:commits` checks your commits locally, and CI checks every commit in the pull request.

## Rebasing

If `main` moved while your pull request was open, bring your branch up to date by rebasing, not by merging `main` into it:

```bash
git fetch origin
git rebase origin/main
git push --force-with-lease
```

`--force-with-lease` refuses to overwrite commits on the remote that you have not seen. Resolve any conflict in the files Git names, run `git add <file>` for each, then `git rebase --continue`. Only force-push your own branch.

## Adding or changing a plugin

<!-- content:claude:start -->
[docs/authoring.md](docs/authoring.md) explains each component type and points at the example plugin to copy.
<!-- content:claude:end -->
In short: a plugin is a directory under `plugins/`, with a `package.json` (private, carrying the version), a `.claude-plugin/plugin.json`, its components, a README with a "Content owner" section, and an entry in `.claude-plugin/marketplace.json` whose `source` is `./plugins/<name>`.
Do not set a `version` in the marketplace entry, do not add a `skills` key anywhere, give each skill a `name` equal to its directory, and keep skill names unique across the repository. `pnpm run lint` enforces these through the shared ESLint config, and `pnpm run check:skills` checks that the `skills` CLI finds and lists every skill. The manifests and `package.json` files are written in one canonical layout with sorted keys, so write them in any order and run `pnpm run lint:fix`.

## Before you ask for review

- `pnpm run validate` passes.
- Every commit follows the convention above.
- New behaviour is documented where a reader would look for it.
- The pull request description says what changed and why, in a few plain sentences.

## Reporting problems

Security issues follow [SECURITY.md](SECURITY.md), not the public issue tracker. Everything else is welcome as an issue: say what you did, what you expected and what happened, and include the command output.

By taking part you agree to the [code of conduct](CODE_OF_CONDUCT.md).
