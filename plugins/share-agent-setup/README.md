# share-agent-setup

Contribute a skill, agent, command, rule or hook from your own Claude Code setup to a plugin marketplace, or share it directly as a setup prompt.

The default target is a marketplace you can push to: the skill turns the piece into real plugin files, checks them for personal details, validates them with the marketplace's own tooling and opens a draft pull request. Pointed at another person's marketplace it forks the repository, follows its contribution guidelines and asks before opening the pull request. With `--direct` it skips marketplaces and writes a self-contained prompt that the recipient pastes into their own Claude Code, shared as a secret gist.

## Try it

```bash
claude --plugin-dir ./plugins/share-agent-setup
```

Then run `/share-agent-setup:share-agent-setup <piece>`, optionally with `--to <owner>/<repo>`, `--plugin <name>`, `--direct` or `--no-gist`.

## Content owner

The repository maintainers.
