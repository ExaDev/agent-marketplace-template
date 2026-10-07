/** Prefixes Claude Code reserves for Anthropic's own plugins. */
const RESERVED_PREFIXES = ['claude-', 'anthropic-', 'anthropics-', 'cc-plugin-'] as const;
/** Names Claude Code reserves outright. */
const RESERVED_NAMES = ['claude', 'anthropic', 'anthropics', 'claude-code', 'claude-mods'] as const;
/** Words that, with `official` beside them, pass a plugin off as Anthropic's. */
const OFFICIAL_COMPANIONS = ['claude', 'anthropic'] as const;

/**
 * Why Claude Code rejects `name` as a third-party plugin name, or undefined when it does not. Mirrors the rule
 * `claude plugin validate` reports as "is reserved: it passes as one of Anthropic's own", so the check fails
 * locally on a Claude Code version that predates it. "Beside" is read as adjacent hyphen-separated words, in
 * either order; Claude Code's own wording does not define it more precisely.
 */
export function reservedPluginNameReason(name: string): string | undefined {
  const lower = name.toLowerCase();
  const prefix = RESERVED_PREFIXES.find((candidate) => lower.startsWith(candidate));
  if (prefix !== undefined) return `starts with "${prefix}"`;
  if (RESERVED_NAMES.some((reserved) => reserved === lower)) return `is the reserved name "${lower}"`;
  const words = lower.split('-');
  const beside = words.some((word, index) => {
    const next = words[index + 1];
    if (next === undefined) return false;
    const isCompanion = (candidate: string): boolean => OFFICIAL_COMPANIONS.some((companion) => companion === candidate);
    return (word === 'official' && isCompanion(next)) || (isCompanion(word) && next === 'official');
  });
  if (beside) return 'puts "official" beside "claude" or "anthropic"';
  return undefined;
}
