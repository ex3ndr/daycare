import { Lexer, type Token, type Tokens } from "marked";

/**
 * Converts GitHub-flavored markdown to Telegram-compatible HTML.
 *
 * Telegram HTML supports: b, i, u, s, code, pre, a, blockquote.
 * Unsupported GFM features (tables, images, headers) are rendered as plain text.
 *
 * Expects: markdown string.
 * Returns: escaped HTML string safe for Telegram parse_mode="HTML".
 */
export function markdownToTelegramHtml(markdown: string): string {
  const lexer = new Lexer({ gfm: true });
  const tokens = lexer.lex(markdown);
  return renderTokens(tokens);
}

/** Escapes HTML special characters for safe rendering */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Renders a list of tokens to Telegram HTML */
function renderTokens(tokens: Token[]): string {
  return tokens.map(renderToken).join("");
}

/** Renders a single token to Telegram HTML */
function renderToken(token: Token): string {
  switch (token.type) {
    case "paragraph":
      return renderInline(token as Tokens.Paragraph) + "\n";

    case "text":
      // Top-level text may contain nested tokens
      if ("tokens" in token && token.tokens) {
        return renderTokens(token.tokens);
      }
      return escapeHtml((token as Tokens.Text).text);

    case "heading":
      // Telegram doesn't support headers; render as bold
      return `<b>${renderInline(token as Tokens.Heading)}</b>\n`;

    case "code":
      return renderCodeBlock(token as Tokens.Code);

    case "blockquote":
      return renderBlockquote(token as Tokens.Blockquote);

    case "list":
      return renderList(token as Tokens.List);

    case "list_item":
      return renderListItem(token as Tokens.ListItem);

    case "space":
      return "\n";

    case "hr":
      return "---\n";

    case "html":
      return (token as Tokens.HTML).text;

    case "table":
      return renderTable(token as Tokens.Table);

    default:
      // For unknown block types, try to render inline content or raw text
      if ("tokens" in token && token.tokens) {
        return renderTokens(token.tokens);
      }
      if ("text" in token && typeof token.text === "string") {
        return escapeHtml(token.text);
      }
      return "";
  }
}

/** Renders inline content from a token with nested tokens */
function renderInline(token: { tokens?: Token[]; text?: string }): string {
  if (token.tokens) {
    return token.tokens.map(renderInlineToken).join("");
  }
  return escapeHtml(token.text ?? "");
}

/** Renders inline tokens (bold, italic, code, links, etc.) */
function renderInlineToken(token: Token): string {
  switch (token.type) {
    case "text":
      return escapeHtml((token as Tokens.Text).text);

    case "strong":
      return `<b>${renderInline(token as Tokens.Strong)}</b>`;

    case "em":
      return `<i>${renderInline(token as Tokens.Em)}</i>`;

    case "del":
      return `<s>${renderInline(token as Tokens.Del)}</s>`;

    case "codespan":
      return `<code>${escapeHtml((token as Tokens.Codespan).text)}</code>`;

    case "link":
      return renderLink(token as Tokens.Link);

    case "image": {
      const img = token as Tokens.Image;
      // Telegram doesn't support inline images; show alt text with link
      return `[${escapeHtml(img.text)}](${escapeHtml(img.href)})`;
    }

    case "br":
      return "\n";

    case "escape":
      return escapeHtml((token as Tokens.Escape).text);

    default:
      if ("tokens" in token && token.tokens) {
        return renderInline(token);
      }
      if ("text" in token && typeof token.text === "string") {
        return escapeHtml(token.text);
      }
      return "";
  }
}

/** Renders a code block with optional language */
function renderCodeBlock(token: Tokens.Code): string {
  const escaped = escapeHtml(token.text);
  if (token.lang) {
    return `<pre><code class="language-${escapeHtml(token.lang)}">${escaped}</code></pre>\n`;
  }
  return `<pre>${escaped}</pre>\n`;
}

/** Renders a blockquote */
function renderBlockquote(token: Tokens.Blockquote): string {
  const inner = renderTokens(token.tokens).trim();
  return `<blockquote>${inner}</blockquote>\n`;
}

/** Renders a link */
function renderLink(token: Tokens.Link): string {
  const text = renderInline(token);
  const href = escapeHtml(token.href);
  return `<a href="${href}">${text}</a>`;
}

/** Renders a list (ordered or unordered) */
function renderList(token: Tokens.List): string {
  const startNum = typeof token.start === "number" ? token.start : 1;
  const items = token.items.map((item, index) => {
    const prefix = token.ordered ? `${startNum + index}. ` : "• ";
    const content = renderListItemContent(item);
    return prefix + content;
  });
  return items.join("\n") + "\n";
}

/** Renders list item content */
function renderListItem(token: Tokens.ListItem): string {
  return renderListItemContent(token);
}

/** Renders the content of a list item */
function renderListItemContent(item: Tokens.ListItem): string {
  // Handle task list items
  const checkbox = item.checked === true ? "☑ " : item.checked === false ? "☐ " : "";

  const content = item.tokens.map((t) => {
    if (t.type === "text" && "tokens" in t && t.tokens) {
      return t.tokens.map(renderInlineToken).join("");
    }
    if (t.type === "paragraph") {
      return renderInline(t);
    }
    return renderToken(t);
  }).join("").trim();

  return checkbox + content;
}

/** Renders a table as plain text (Telegram doesn't support tables) */
function renderTable(token: Tokens.Table): string {
  const rows: string[] = [];

  // Header row
  const headerCells = token.header.map((cell) => renderInline(cell));
  rows.push("| " + headerCells.join(" | ") + " |");

  // Separator
  rows.push("| " + token.header.map(() => "---").join(" | ") + " |");

  // Body rows
  for (const row of token.rows) {
    const cells = row.map((cell) => renderInline(cell));
    rows.push("| " + cells.join(" | ") + " |");
  }

  return rows.join("\n") + "\n";
}
