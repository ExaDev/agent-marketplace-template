/**
 * The content manifest: the one place that says which parts of this repository belong to which content type.
 *
 * `core` is always kept. `claude` is the Claude Code plugin marketplace. `skills` is the skills CLI surface (its
 * docs and its listing check) and, when `claude` is not also selected, a plain root `skills/` repository.
 * `template` is not a content type: it marks what exists only so the template can generate a repository, and
 * `scripts/init.ts` removes it from the generated one.
 *
 * Files, directories and package.json entries are owned here. Parts of a shared file are owned with marker
 * comment lines (`<!-- content:claude:start -->` and `<!-- content:claude:end -->` in Markdown, `//` in
 * TypeScript, `#` in YAML and shell), which `scripts/init.ts` removes or unwraps.
 */

export const CONTENT_TYPES = ['core', 'skills', 'claude'] as const;
export type ContentType = (typeof CONTENT_TYPES)[number];

/** Content types a user chooses between; `core` is implied. Order is the canonical order of a normalised list. */
export const SELECTABLE_CONTENT = ['skills', 'claude'] as const satisfies readonly ContentType[];
export type SelectableContent = (typeof SELECTABLE_CONTENT)[number];

export type Owner = ContentType | 'template';

export interface ContentModule {
  /** Repository-relative files and directories removed when the type is not selected. */
  readonly paths: readonly string[];
  /** devDependencies removed from package.json when the type is not selected. */
  readonly devDependencies: readonly string[];
  /** Top-level keys of pnpm-workspace.yaml removed when the type is not selected. */
  readonly workspaceKeys: readonly string[];
}

export interface ContentManifest {
  readonly modules: Readonly<Record<ContentType, ContentModule>>;
  /** Paths that exist only in the template repository. */
  readonly templatePaths: readonly string[];
}

export const CONTENT_MANIFEST: ContentManifest = {
  modules: {
    core: {
      paths: [
        'package.json',
        'tsconfig.json',
        'commit-types.ts',
        'commitlint.config.ts',
        'lint-staged.config.ts',
        '.husky',
        'scripts/check-skills.ts',
        'scripts/check-skills.test.ts',
        'scripts/check-ci-skip-tokens.ts',
        'scripts/check-ci-skip-tokens.test.ts',
        'scripts/generate-readme-table.ts',
        'scripts/lib',
      ],
      devDependencies: [
        '@commitlint/cli',
        '@commitlint/config-conventional',
        '@commitlint/types',
        '@types/node',
        'husky',
        'lint-staged',
        'tsx',
        'typescript',
        'yaml',
        'zod',
      ],
      workspaceKeys: [],
    },
    skills: {
      paths: ['docs/skills-cli.md'],
      devDependencies: ['skills'],
      workspaceKeys: [],
    },
    claude: {
      paths: [
        '.claude-plugin',
        'plugins',
        'release-workspace.config.ts',
        'scripts/sync-plugin-version.ts',
        'scripts/sync-plugin-version.test.ts',
        'scripts/validate-plugins.ts',
        'docs/authoring.md',
        'docs/cross-marketplace.md',
        'docs/distribution.md',
        'docs/releasing.md',
      ],
      devDependencies: [
        '@exadev/semantic-release-workspace',
        '@semantic-release/changelog',
        '@semantic-release/commit-analyzer',
        '@semantic-release/exec',
        '@semantic-release/git',
        '@semantic-release/github',
        '@semantic-release/npm',
        '@semantic-release/release-notes-generator',
        'conventional-changelog-conventionalcommits',
        'semantic-release',
      ],
      workspaceKeys: ['packages', 'minimumReleaseAgeExclude'],
    },
  },
  templatePaths: [
    'scripts/content.ts',
    'scripts/init.ts',
    'scripts/init.test.ts',
    'scripts/init',
    '.github/workflows/template-selfcheck.yml',
  ],
};

/** Plugins whose skills move to the root `skills/` directory when `claude` is not selected. */
export const ROOT_SKILL_EXAMPLES = {
  /** The example plugin that holds the example skills. */
  plugin: 'example-skills',
  /** Directories of that plugin moved to the repository root, keeping their relative depth so `../../shared/...` links in skills still resolve. */
  moves: ['skills', 'shared'],
} as const;

/** Plugins whose name starts with this prefix are examples, removed by `--examples none`. */
export const EXAMPLE_PLUGIN_PREFIX = 'example-';

/** The skill written when `--examples none` leaves a skills-only repository with no skill at all. */
export const STARTER_SKILL = 'starter';

/**
 * Turns the value of `--content` into the canonical selection. Splits on commas, trims, expands `all`, collapses
 * duplicates and orders by `SELECTABLE_CONTENT`. Throws, naming the valid values, on an empty list or an unknown value.
 */
export function parseContentList(raw: string): SelectableContent[] {
  const valid = [...SELECTABLE_CONTENT, 'all'].join(', ');
  const items = raw.split(',').map((item) => item.trim());
  if (items.every((item) => item === '')) throw new Error(`--content is empty; valid values: ${valid}`);
  const chosen = new Set<SelectableContent>();
  for (const item of items) {
    if (item === 'all') for (const type of SELECTABLE_CONTENT) chosen.add(type);
    else if (isSelectable(item)) chosen.add(item);
    else throw new Error(`unknown --content value "${item}"; valid values: ${valid}`);
  }
  return SELECTABLE_CONTENT.filter((type) => chosen.has(type));
}

function isSelectable(value: string): value is SelectableContent {
  return SELECTABLE_CONTENT.some((type) => type === value);
}

/** The content types a selection keeps: `core` plus the selected ones. */
export function selectedTypes(selection: readonly SelectableContent[]): ReadonlySet<ContentType> {
  return new Set<ContentType>(['core', ...selection]);
}

interface ScriptDefinition {
  readonly owner: Owner;
  readonly command: (selected: ReadonlySet<ContentType>) => string;
}

/**
 * The order and owner of the steps `validate` runs. The `validate` script is composed from the steps whose
 * owner is kept, so a repository without `claude` never calls a plugin check.
 */
export const VALIDATE_STEPS: readonly { readonly script: string; readonly owner: ContentType }[] = [
  { script: 'typecheck', owner: 'core' },
  { script: 'check:skills', owner: 'core' },
  { script: 'check:versions', owner: 'claude' },
  { script: 'check:readme', owner: 'core' },
  { script: 'validate:plugins', owner: 'claude' },
];

/** Every package.json script, in the order package.json lists them. */
export const SCRIPT_DEFINITIONS: Readonly<Record<string, ScriptDefinition>> = {
  prepare: { owner: 'core', command: () => 'husky' },
  typecheck: { owner: 'core', command: () => 'tsc --noEmit' },
  test: { owner: 'core', command: () => 'node --import tsx --test "scripts/*.test.ts"' },
  'check:skills': { owner: 'core', command: (selected) => `tsx scripts/check-skills.ts${selected.has('skills') ? ' --with-cli' : ''}` },
  'check:versions': { owner: 'claude', command: () => 'tsx scripts/sync-plugin-version.ts --check' },
  'check:readme': { owner: 'core', command: () => 'tsx scripts/generate-readme-table.ts --check' },
  'check:ci-skip': { owner: 'core', command: () => 'tsx scripts/check-ci-skip-tokens.ts' },
  'lint:commits': { owner: 'core', command: () => 'commitlint' },
  'validate:plugins': { owner: 'claude', command: () => 'tsx scripts/validate-plugins.ts' },
  validate: {
    owner: 'core',
    command: (selected) =>
      VALIDATE_STEPS.filter((step) => selected.has(step.owner))
        .map((step) => `pnpm run ${step.script}`)
        .join(' && '),
  },
  readme: { owner: 'core', command: () => 'tsx scripts/generate-readme-table.ts' },
  release: { owner: 'claude', command: () => 'semantic-release-workspace release --config release-workspace.config.ts' },
  init: { owner: 'template', command: () => 'tsx scripts/init.ts' },
};

/** The package.json scripts for a kept set of types; `template` scripts appear only when `includeTemplate` is set. */
export function buildScripts(selected: ReadonlySet<ContentType>, includeTemplate: boolean): Record<string, string> {
  const scripts: Record<string, string> = {};
  for (const [name, definition] of Object.entries(SCRIPT_DEFINITIONS)) {
    const kept = definition.owner === 'template' ? includeTemplate : selected.has(definition.owner);
    if (kept) scripts[name] = definition.command(selected);
  }
  return scripts;
}
