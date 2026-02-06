import { Lexer, type Token, type TokensList } from "marked";

/**
 * Result of parsing GitHub-flavored markdown.
 * Contains both the token list (AST) and accessors for common elements.
 */
export interface MarkdownParseResult {
  /** Raw token list from marked lexer */
  tokens: TokensList;
  /** Extract all headings with their depth and text */
  headings: { depth: number; text: string }[];
  /** Extract all code blocks with optional language */
  codeBlocks: { lang: string | undefined; text: string }[];
  /** Extract all links */
  links: { href: string; text: string }[];
  /** Extract plain text content (strips formatting) */
  plainText: string;
}

/**
 * Parses GitHub-flavored markdown into a structured result.
 *
 * Expects: markdown string input.
 * Returns: parsed tokens and extracted elements (headings, code blocks, links).
 */
export function markdownParse(markdown: string): MarkdownParseResult {
  const lexer = new Lexer({ gfm: true });
  const tokens = lexer.lex(markdown);

  return {
    tokens,
    get headings() {
      return extractHeadings(tokens);
    },
    get codeBlocks() {
      return extractCodeBlocks(tokens);
    },
    get links() {
      return extractLinks(tokens);
    },
    get plainText() {
      return extractPlainText(tokens);
    },
  };
}

/** Recursively extracts headings from token tree */
function extractHeadings(
  tokens: Token[]
): { depth: number; text: string }[] {
  const headings: { depth: number; text: string }[] = [];

  for (const token of tokens) {
    if (token.type === "heading") {
      headings.push({ depth: token.depth, text: token.text });
    }
    if ("tokens" in token && Array.isArray(token.tokens)) {
      headings.push(...extractHeadings(token.tokens));
    }
  }

  return headings;
}

/** Recursively extracts code blocks from token tree */
function extractCodeBlocks(
  tokens: Token[]
): { lang: string | undefined; text: string }[] {
  const blocks: { lang: string | undefined; text: string }[] = [];

  for (const token of tokens) {
    if (token.type === "code") {
      blocks.push({ lang: token.lang || undefined, text: token.text });
    }
    if ("tokens" in token && Array.isArray(token.tokens)) {
      blocks.push(...extractCodeBlocks(token.tokens));
    }
  }

  return blocks;
}

/** Recursively extracts links from token tree */
function extractLinks(tokens: Token[]): { href: string; text: string }[] {
  const links: { href: string; text: string }[] = [];

  for (const token of tokens) {
    if (token.type === "link") {
      links.push({ href: token.href, text: token.text });
    }
    if ("tokens" in token && Array.isArray(token.tokens)) {
      links.push(...extractLinks(token.tokens));
    }
  }

  return links;
}

/** Extracts plain text content, stripping all markdown formatting */
function extractPlainText(tokens: Token[]): string {
  const parts: string[] = [];

  for (const token of tokens) {
    if (token.type === "text" || token.type === "codespan") {
      parts.push(token.text);
    } else if (token.type === "code") {
      parts.push(token.text);
    } else if (token.type === "heading" || token.type === "paragraph") {
      parts.push(token.text);
    } else if ("tokens" in token && Array.isArray(token.tokens)) {
      parts.push(extractPlainText(token.tokens));
    }
  }

  return parts.join(" ").replace(/\s+/g, " ").trim();
}
