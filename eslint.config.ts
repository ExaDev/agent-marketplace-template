import { defineConfig } from 'eslint/config';
import js from '@eslint/js';
import markdown from '@eslint/markdown';
// content:claude:start
import globals from 'globals';
// content:claude:end
import { exadevConfig } from '@exadev/eslint-config';

export default defineConfig(
  {
    // Each CHANGELOG.md is written by the release tool, and AGENTS.md and CLAUDE.md are symlinks to README.md, which is linted once under its own name.
    ignores: ['node_modules', '**/CHANGELOG.md', 'AGENTS.md', 'CLAUDE.md'],
  },
  {
    languageOptions: {
      parserOptions: { project: ['./tsconfig.json'], tsconfigRootDir: import.meta.dirname },
    },
  },
  { ...js.configs.recommended, files: ['**/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}'] },
  ...exadevConfig(),
  // content:claude:start
  {
    // Scripts a plugin ships run under Node, outside this repository's TypeScript build.
    files: ['plugins/**/*.{js,mjs}'],
    languageOptions: { globals: globals.node },
  },
  {
    // A workflow script is the body of an async function the runtime calls, so its API arrives as globals declared in workflow-globals.d.ts.
    files: ['plugins/*/workflows/*.js'],
    languageOptions: { globals: { agent: 'readonly' } },
  },
  // content:claude:end
  {
    files: ['**/*.md'],
    plugins: { markdown },
    language: 'markdown/gfm',
    languageOptions: { frontmatter: 'yaml' },
    extends: ['markdown/recommended'],
  },
);
