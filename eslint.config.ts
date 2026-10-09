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
    // Plain JavaScript has no other place for its types than JSDoc `{type}` annotations, which tsdoc/syntax and jsdoc/no-types forbid because they assume TypeScript source. The type-aware rules still need those annotations to see anything but `any`. Remove this override once https://github.com/ExaDev/eslint-config/issues/125 (scope tsdoc/syntax and jsdoc/no-types to TypeScript files) ships.
    rules: { 'tsdoc/syntax': 'off', 'jsdoc/no-types': 'off' },
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
