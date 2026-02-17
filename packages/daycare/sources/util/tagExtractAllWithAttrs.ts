import { escapeRegExp } from "./tagExtract.js";

export type TagExtractAllWithAttrsResult = {
  content: string;
  attrs: Record<string, string>;
};

/**
 * Extracts all non-overlapping `<tag ...>...</tag>` blocks and parsed opening-tag attributes.
 * Expects: attributes are quoted (`key="value"` or `key='value'`).
 */
export function tagExtractAllWithAttrs(text: string, tag: string): TagExtractAllWithAttrsResult[] {
  const results: TagExtractAllWithAttrsResult[] = [];
  const openPattern = new RegExp(`<${escapeRegExp(tag)}(\\s[^>]*)?>`, "gi");
  const closePattern = new RegExp(`</${escapeRegExp(tag)}\\s*>`, "gi");

  let cursor = 0;
  while (cursor < text.length) {
    openPattern.lastIndex = cursor;
    const openMatch = openPattern.exec(text);
    if (!openMatch) {
      break;
    }

    const contentStart = openMatch.index + openMatch[0].length;
    closePattern.lastIndex = contentStart;
    const closeMatch = closePattern.exec(text);
    if (!closeMatch) {
      break;
    }

    results.push({
      content: text.slice(contentStart, closeMatch.index).trim(),
      attrs: attrsParse(openMatch[1] ?? "")
    });

    cursor = closeMatch.index + closeMatch[0].length;
  }

  return results;
}

function attrsParse(input: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const attrPattern = /([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;

  let match: RegExpExecArray | null;
  while ((match = attrPattern.exec(input)) !== null) {
    const key = match[1];
    if (!key) {
      continue;
    }
    const value = match[2] ?? match[3] ?? "";
    attrs[key] = value;
  }

  return attrs;
}
