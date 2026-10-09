import { RuleConfigSeverity, type SyncRule, type UserConfig } from '@commitlint/types';
import { allowedScopes, COMMIT_TYPE_NAMES, RELEASE_TOOL_COMMIT } from './commit-types.ts';
import { findSkipTokens } from './scripts/lib/ci-skip.ts';

/** Rejects a commit message that carries a token GitHub reads as a request to skip the workflow runs. */
const noCiSkipToken: SyncRule = ({ raw }) => {
  const tokens = findSkipTokens(raw ?? '');

  return [tokens.length === 0, `the message contains ${tokens.join(', ')}, which would skip CI`];
};

const config: UserConfig = {
  extends: ['@commitlint/config-conventional'],
  ignores: [(message: string): boolean => RELEASE_TOOL_COMMIT.test(message)],
  plugins: [
    {
      rules: { 'no-ci-skip-token': noCiSkipToken },
    },
  ],
  rules: {
    'type-enum': [RuleConfigSeverity.Error, 'always', [...COMMIT_TYPE_NAMES]],
    'scope-enum': [RuleConfigSeverity.Error, 'always', allowedScopes(import.meta.dirname)],
    'no-ci-skip-token': [RuleConfigSeverity.Error, 'always'],
  },
};

export default config;
