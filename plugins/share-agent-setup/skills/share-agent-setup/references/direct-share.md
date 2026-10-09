# Direct share: a setup prompt and a secret gist

Used when `--direct` is given. It produces one self-contained prompt that a recipient pastes into their own Claude Code to build their own version of the piece, adapted to their machine. A prompt beats sending files because the recipient's environment differs (terminal, OS, Claude Code version, folder layout): a spec lets their Claude adapt and verify, while a copied file silently carries the sender's paths and conventions.

## Steps

1. Read each piece in full as in step 1 of the main procedure, and separate behaviour from machine as in step 4.
2. Write one prompt covering every piece, stating shared preamble, compatibility checks, portability rules and the test plan once. Use the shape below and omit a section that has nothing to say.
   - First instruction: where to create it (a skill at `~/.claude/skills/<name>/SKILL.md` is personal and works in every project; a project skill goes in `.claude/skills/`), and to show a plan and the exact files first and ask for confirmation before writing anything.
   - What it does, in two or three sentences, and the compatibility checks to run first (the OS, that a needed command or app exists, that a feature exists in their Claude Code version), with an instruction to stop and say so if one fails.
   - Behaviour to build, numbered, written as instructions to Claude, with the reasoning for any non-obvious rule since their Claude will meet cases the list does not cover.
   - Mechanics: the exact commands, API calls or file formats, tested ones only, with the pitfalls found while building them. Scripts go in files inside the skill folder and take inputs as arguments, never spliced into source.
   - Build it cleanly: survey for something that already does part of the job and ask whether to extend it rather than duplicate it silently.
   - Platform and fallback, and an explicit rule not to guess on an environment it was not built for.
   - Portability: no user names or machine paths (use `$HOME`, `~` and commands evaluated at run time).
   - Test it before finishing: a harmless dry run, showing the exact action the first time and asking before a real one, and a request to report what could not be verified.
3. Write the file to a task-named directory under the session scratchpad (never a generic name, which another agent may overwrite) as `<slug>-setup-prompt.md`: a title, a line saying where to paste it, the prompt inside a four-backtick fence so triple-backtick blocks survive, and a short notes section for the person setting it up.
4. Run `${CLAUDE_SKILL_DIR}/scripts/leak-check.sh <file>` and fix every hit until it exits 0, then read the file once more for client, private repository and person names.
5. Unless `--no-gist`, run `${CLAUDE_SKILL_DIR}/scripts/share-gist.sh <file> <slug>`. The slug names the use case (the piece's own name, or the sorted names joined with `+`), so a re-run updates the gist it made before. The script refuses when the leak check finds anything or the slug has characters other than letters, digits and `. _ + -`. It needs `gh` logged in with the gist scope.
6. Report the gist link first, what the prompt covers, what was left out on purpose, and that a prompt never followed on a clean setup is untested from the recipient's side. Passing the link to the recipient is the user's step.

## Gotchas

- The gist is secret, not private: anyone holding the link can read it. Never pass `--public`, and never edit another account's gist.
- After creating one, confirm it is secret with `gh api gists/<id> --jq .public`, which must print `false`. To take a gist down, `gh gist delete <id> --yes`: without `--yes` the command refuses to run outside a terminal.
- `gh gist create` has no `--secret` flag (secret is its default), and `--filename` only names a file read from stdin, which is why `share-gist.sh` pipes the file in.
- Describing a feature the recipient may not have without a check makes their Claude invent a workaround. Put the check first.
- Verified mechanics only: leave out a step that was never run, or mark it untried.
