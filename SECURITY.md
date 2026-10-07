# Security policy

## Reporting a vulnerability

Do not open a public issue for a security problem. Use the repository's private reporting channel: on GitHub, open the Security tab and choose "Report a vulnerability". If that is not enabled, contact `SECURITY_CONTACT_PLACEHOLDER`.

Say what is affected, how to reproduce it and what an attacker gains. Expect an acknowledgement, and a fix or a decision on whether it will be fixed, after that.

## What counts

A plugin installed from a marketplace runs with the installing user's privileges: its hooks, MCP servers, monitors and executables are ordinary processes. Treat these as in scope:

- a plugin or script in this repository that runs, reads or sends something its description does not say
- a workflow that can be made to execute code from a pull request with a privileged token, or to leak a secret
- a default configuration that makes the repository unsafe, such as a permissive ruleset or a committed secret

## For people installing plugins

Read what a plugin does before you install it, in particular its hooks, MCP servers and `bin/` directory.
Claude Code's guidance is at https://code.claude.com/docs/en/plugins/security.
<!-- content:claude:start -->
Pin a plugin to a tag or commit when you need it not to change underneath you ([docs/cross-marketplace.md](docs/cross-marketplace.md)).
<!-- content:claude:end -->

## For maintainers

- Keep third-party actions pinned to a full commit SHA, with the tag in a comment.
- The `ci-skip-guard` workflow runs on `pull_request_target`. It must check out the base commit only and never run code from the pull request.
- Store the release token as a repository secret, with the narrowest scope that can push to `main` and create tags. Never write it in a file or a workflow.
- Do not commit credentials, `.env` files or machine-local settings. `.claude/settings.local.json` is git-ignored for that reason.
