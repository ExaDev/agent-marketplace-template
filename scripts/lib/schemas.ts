import { readFileSync } from 'node:fs';
import { z } from 'zod';

/** A marketplace entry source is a relative path string or an object naming a remote source (github, git-subdir and so on). */
export const marketplaceEntrySchema = z.looseObject({
  name: z.string().min(1),
  source: z.union([z.string(), z.looseObject({})]),
  description: z.string().optional(),
});

export const marketplaceSchema = z.looseObject({
  name: z.string().min(1),
  owner: z.looseObject({ name: z.string().min(1) }),
  plugins: z.array(marketplaceEntrySchema),
});

export const pluginManifestSchema = z.looseObject({
  name: z.string().min(1),
  version: z.string().optional(),
  description: z.string().optional(),
  author: z.looseObject({ name: z.string().min(1) }).optional(),
  license: z.string().optional(),
});

export const packageJsonSchema = z.looseObject({
  name: z.string().min(1),
  version: z.string().optional(),
  scripts: z.record(z.string(), z.string()).optional(),
  devDependencies: z.record(z.string(), z.string()).optional(),
});

export type Marketplace = z.infer<typeof marketplaceSchema>;
export type MarketplaceEntry = z.infer<typeof marketplaceEntrySchema>;
export type PluginManifest = z.infer<typeof pluginManifestSchema>;
export type PackageJson = z.infer<typeof packageJsonSchema>;

/** Reads and validates a JSON file; throws with the file path on a syntax or schema error. */
export function readJson<T>(path: string, schema: z.ZodType<T>): T {
  const parsed = schema.safeParse(JSON.parse(readFileSync(path, 'utf8')));
  if (!parsed.success) throw new Error(`${path}: ${z.prettifyError(parsed.error)}`);

  return parsed.data;
}

/** The members of a JSON object file in the order the file lists them, where `readJson` returns them in the schema's order. Throws when the file is not a JSON object. */
export function readJsonMembers(path: string): Record<string, unknown> {
  const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'));

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) throw new Error(`${path}: expected a JSON object`);

  return Object.fromEntries(Object.entries(parsed));
}
