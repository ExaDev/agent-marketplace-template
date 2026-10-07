# Private marketplaces and git credentials

A marketplace can live in a private repository. Claude Code has no git token of its own and `marketplace.json` has no field for one. When someone adds the marketplace, installs from it or updates it, Claude Code runs `git` on their machine with interactive prompts turned off and relies on the credentials that machine already holds. Anything git would have to ask for fails instead of prompting. This is documented in [host and maintain a marketplace](https://code.claude.com/docs/en/plugins/host-marketplace#grant-access-to-a-private-marketplace) and [install and manage plugins](https://code.claude.com/docs/en/plugins/install#add-a-private-marketplace).

## Which protocol is used

- `owner/repo` shorthand: Claude Code checks whether the person's SSH key authenticates to github.com and clones over SSH if it does, otherwise over HTTPS. Setting `CLAUDE_CODE_PLUGIN_PREFER_HTTPS=1` skips the check and always uses HTTPS.
- `git@host:path.git`: SSH.
- `https://host/path.git`: HTTPS. Use the full URL for any host other than github.com.

## HTTPS: a stored credential

The credential helper stays enabled but cannot prompt, so a credential must already be stored. On GitHub:

```bash
gh auth login
gh auth setup-git
```

`gh auth setup-git` registers the GitHub CLI as the git credential helper for github.com, so the token `gh` holds answers git's request. The macOS Keychain helper, Git Credential Manager and `git-credential-store` work the same way once they hold a credential for the host.

## SSH

The key must work without a passphrase prompt, for example because it is loaded in `ssh-agent`, and the host must already be in `known_hosts`. If git is configured with `GIT_SSH_COMMAND`, `GIT_SSH` or `core.sshCommand`, Claude Code runs that program.

## CI and containers: `GH_TOKEN`

An environment variable alone does not authenticate a clone. `GITHUB_TOKEN` or `GH_TOKEN` takes effect through a credential helper that reads it, which is what the GitHub CLI's helper does. In CI, export a token that can read the marketplace repository and register the helper:

```yaml
- run: gh auth setup-git
  env:
    GH_TOKEN: ${{ secrets.MARKETPLACE_READ_TOKEN }}
```

The default workflow token can read only the workflow's own repository, so a marketplace in another repository needs a personal access token or an app token. For images and runners that cannot clone at runtime, a pre-populated plugin directory selected with `CLAUDE_CODE_PLUGIN_SEED_DIR` avoids git access altogether ([manage plugins for your organisation](https://code.claude.com/docs/en/plugins/org#seed-containers-and-ci)).

## Auto-update

Auto-update is off by default for a marketplace like this one.
<!-- content:claude:start -->
People turn it on from the Marketplaces tab in `/plugin`, or an administrator sets `autoUpdate` in managed settings ([distribution.md](distribution.md)).
<!-- content:claude:end -->
The background check uses the same non-prompting credential helpers:

- an SSH key in `ssh-agent`, or an HTTPS credential the helper can supply without asking, authenticates it;
- a helper that would need to prompt makes the check fail quietly, and Claude Code then re-clones the marketplace and replaces the existing checkout, keeping the old one only if that clone also fails;
- `CLAUDE_CODE_PLUGIN_KEEP_MARKETPLACE_ON_FAILURE=1` keeps the existing checkout without attempting the re-clone when the check cannot reach or authenticate to the remote.

The practical rule for a private marketplace: sign in to the credential helper first so it holds a credential for the host, then turn on auto-update.

## Plugins in other private repositories

A plugin listed by a `github` or `git-subdir` source in a private repository is fetched with the same credentials, so every installer needs read access to that repository as well. People without a git host account can only install plugins whose sources they can reach, such as an `archive` source over HTTPS.

## The `skills` CLI

`npx skills add <owner>/<repo>` uses the authentication already configured for the repository URL.
<!-- content:skills:start -->
The same stored credential serves both tools ([skills-cli.md](skills-cli.md)).
<!-- content:skills:end -->
