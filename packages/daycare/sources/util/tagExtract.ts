/**
 * Extracts the content between the first opening and last closing occurrence
 * of an XML-like tag in text. Case-insensitive tag matching. Opening tag may
 * include attributes (e.g. `<response foo="bar">`). Content is returned
 * unmodified except for leading/trailing whitespace trimming.
 *
 * Returns null if either the opening or closing tag is missing.
 */
export function tagExtract(text: string, tag: string): string | null {
  const openIndex = findOpenTag(text, tag);
  if (openIndex === -1) {
    return null;
  }

  // Find end of the opening tag (the closing `>`)
  const openTagEnd = text.indexOf(">", openIndex);
  if (openTagEnd === -1) {
    return null;
  }
  const contentStart = openTagEnd + 1;

  const closeIndex = findLastCloseTag(text, tag);
  if (closeIndex === -1 || closeIndex < contentStart) {
    return null;
  }

  return text.slice(contentStart, closeIndex).trim();
}

/**
 * Removes the matched tag block (first open to last close, inclusive) from text.
 * Returns the remaining text. If no complete tag block is found, returns text unchanged.
 */
export function tagStrip(text: string, tag: string): string {
  const openIndex = findOpenTag(text, tag);
  if (openIndex === -1) {
    return text;
  }

  const closeIndex = findLastCloseTag(text, tag);
  if (closeIndex === -1) {
    return text;
  }

  const closeTag = buildCloseTagPattern(tag);
  const closeMatch = text.slice(closeIndex).match(closeTag);
  if (!closeMatch) {
    return text;
  }
  const blockEnd = closeIndex + closeMatch[0].length;

  if (blockEnd <= openIndex) {
    return text;
  }

  return text.slice(0, openIndex) + text.slice(blockEnd);
}

/**
 * Finds the index of the first opening tag occurrence (case-insensitive).
 * Matches `<tag>` or `<tag ...>` (with attributes).
 */
function findOpenTag(text: string, tag: string): number {
  const pattern = new RegExp(`<${escapeRegExp(tag)}(\\s[^>]*)?>`, "i");
  const match = text.match(pattern);
  return match ? match.index! : -1;
}

/**
 * Finds the index of the last closing tag occurrence (case-insensitive).
 */
function findLastCloseTag(text: string, tag: string): number {
  const pattern = buildCloseTagPattern(tag);
  let lastIndex = -1;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    lastIndex = match.index;
  }
  return lastIndex;
}

function buildCloseTagPattern(tag: string): RegExp {
  return new RegExp(`</${escapeRegExp(tag)}\\s*>`, "gi");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
