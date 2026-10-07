import { CONTENT_TYPES, type ContentType } from '../content.ts';

/** Matches a whole-line marker in any of the three comment syntaxes the repository's text files use. */
const MARKER = /^\s*(?:<!--\s*|\/\/\s*|#\s*)content:([a-z]+):(start|end)(?:\s*-->)?\s*$/;

function isContentType(value: string): value is ContentType {
  return CONTENT_TYPES.some((type) => type === value);
}

/**
 * Applies content markers to one file's text. A block between `content:<type>:start` and `content:<type>:end`
 * lines is dropped, markers included, when `<type>` is not selected, and kept with only its marker lines removed
 * when it is. Throws on an unknown type, a nested or unbalanced marker, or an end that names a different type.
 */
export function applySections(text: string, selected: ReadonlySet<ContentType>, file: string): string {
  const lines = text.split('\n');
  const kept: string[] = [];
  let open: ContentType | undefined;
  let openedAt = 0;
  lines.forEach((line, index) => {
    const marker = MARKER.exec(line);
    const lineNumber = index + 1;
    if (marker?.[1] === undefined || marker[2] === undefined) {
      if (open === undefined || selected.has(open)) kept.push(line);
      return;
    }
    if (!isContentType(marker[1])) throw new Error(`${file}:${String(lineNumber)}: unknown content type "${marker[1]}"`);
    if (marker[2] === 'start') {
      if (open !== undefined) throw new Error(`${file}:${String(lineNumber)}: content:${marker[1]}:start inside the block opened at line ${String(openedAt)}`);
      open = marker[1];
      openedAt = lineNumber;
    } else {
      if (open !== marker[1]) throw new Error(`${file}:${String(lineNumber)}: content:${marker[1]}:end without a matching start`);
      open = undefined;
    }
  });
  if (open !== undefined) throw new Error(`${file}:${String(openedAt)}: content:${open}:start is never closed`);
  return kept.join('\n');
}

/** Whether the text contains any content marker line. */
export function hasSections(text: string): boolean {
  return text.split('\n').some((line) => MARKER.test(line));
}
