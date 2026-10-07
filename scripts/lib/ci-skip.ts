/**
 * Strings in a commit message that make GitHub skip the workflow runs a push or pull request would trigger
 * (https://docs.github.com/en/actions/managing-workflow-runs-and-deployments/managing-workflow-runs/skipping-workflow-runs).
 * A contributor must not be able to bypass required checks this way.
 */
export const CI_SKIP_TOKENS: readonly string[] = ['[skip ci]', '[ci skip]', '[no ci]', '[skip actions]', '[actions skip]', 'skip-checks: true', 'skip-checks:true'];

/** Reports every token that appears in one commit message, case-insensitively. */
export function findSkipTokens(message: string): string[] {
  const lower = message.toLowerCase();
  return CI_SKIP_TOKENS.filter((token) => lower.includes(token));
}
