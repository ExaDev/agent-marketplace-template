import type { UserConfig } from '@commitlint/types';
import { allowedScopes, COMMIT_TYPE_NAMES, RELEASE_TOOL_COMMIT } from './commit-types.ts';
import { findSkipTokens } from './scripts/lib/ci-skip.ts';

const config: UserConfig = {
  extends: ['@commitlint/config-conventional'],
  ignores: [(message) => RELEASE_TOOL_COMMIT.test(message)],
  plugins: [
    {
      rules: {
        'no-ci-skip-token': ({ raw }) => {
          const tokens = findSkipTokens(raw ?? '');
          return [tokens.length === 0, `the message contains ${tokens.join(', ')}, which would skip CI`];
        },
      },
    },
  ],
  rules: {
    'type-enum': [2, 'always', [...COMMIT_TYPE_NAMES]],
    'scope-enum': [2, 'always', allowedScopes(import.meta.dirname)],
    'no-ci-skip-token': [2, 'always'],
  },
};

export default config;
