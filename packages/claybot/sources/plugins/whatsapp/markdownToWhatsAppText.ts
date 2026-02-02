import { Lexer, type Token, type Tokens } from "marked";

/**
 * Converts GitHub-flavored markdown to WhatsApp-compatible text formatting.
 *
 * WhatsApp supports: *bold*, _italic_, ~strikethrough~, ```monospace```
 * Unsupported GFM features (tables, images, links) are rendered as plain text.
 *
 * Expects: markdown string.
 * Returns: WhatsApp-formatted text string.
 */
export function markdownToWhatsAppText(markdown: string): string {
  const lexer = new Lexer({ gfm: true });
  const tokens = lexer.lex(markdown);
  return renderTokens(tokens).trim();
}

/** Renders a list of tokens to WhatsApp text */
function renderTokens(tokens: Token[]): string {
  return tokens.map(renderToken).join("");
}

/** Renders a single token to WhatsApp text */
function renderToken(token: Token): string {
  switch (token.type) {
    case "paragraph":
      return renderInline(token as Tokens.Paragraph) + "\n";

    case "text":
      if ("tokens" in token && token.tokens) {
        return renderTokens(token.tokens);
      }
      return (token as Tokens.Text).text;

    case "heading":
      // WhatsApp doesn't support headers; render as bold
      return `*${renderInline(token as Tokens.Heading)}*\n`;

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
      if ("tokens" in token && token.tokens) {
        return renderTokens(token.tokens);
      }
      if ("text" in token && typeof token.text === "string") {
        return token.text;
      }
      return "";
  }
}

/** Renders inline content from a token with nested tokens */
function renderInline(token: { tokens?: Token[]; text?: string }): string {
  if (token.tokens) {
    return token.tokens.map(renderInlineToken).join("");
  }
  return token.text ?? "";
}

/** Renders inline tokens (bold, italic, code, links, etc.) */
function renderInlineToken(token: Token): string {
  switch (token.type) {
    case "text":
      return (token as Tokens.Text).text;

    case "strong":
      return `*${renderInline(token as Tokens.Strong)}*`;

    case "em":
      return `_${renderInline(token as Tokens.Em)}_`;

    case "del":
      return `~${renderInline(token as Tokens.Del)}~`;

    case "codespan":
      // WhatsApp uses ``` for monospace
      return "```" + (token as Tokens.Codespan).text + "```";

    case "link": {
      const link = token as Tokens.Link;
      const text = renderInline(link);
      // WhatsApp auto-links URLs, so just show text and URL
      if (text === link.href) {
        return link.href;
      }
      return `${text} (${link.href})`;
    }

    case "image": {
      const img = token as Tokens.Image;
      return `[${img.text}](${img.href})`;
    }

    case "br":
      return "\n";

    case "escape":
      return (token as Tokens.Escape).text;

    default:
      if ("tokens" in token && token.tokens) {
        return renderInline(token);
      }
      if ("text" in token && typeof token.text === "string") {
        return token.text;
      }
      return "";
  }
}

/** Renders a code block */
function renderCodeBlock(token: Tokens.Code): string {
  return "```" + token.text + "```\n";
}

/** Renders a blockquote */
function renderBlockquote(token: Tokens.Blockquote): string {
  const inner = renderTokens(token.tokens).trim();
  // WhatsApp doesn't have native blockquote, prefix with >
  const lines = inner.split("\n").map((line) => `> ${line}`);
  return lines.join("\n") + "\n";
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
  const checkbox = item.checked === true ? "☑ " : item.checked === false ? "☐ " : "";

  const content = item.tokens
    .map((t) => {
      if (t.type === "text" && "tokens" in t && t.tokens) {
        return t.tokens.map(renderInlineToken).join("");
      }
      if (t.type === "paragraph") {
        return renderInline(t as Tokens.Paragraph);
      }
      return renderToken(t);
    })
    .join("")
    .trim();

  return checkbox + content;
}

/** Renders a table as plain text */
function renderTable(token: Tokens.Table): string {
  const rows: string[] = [];

  const headerCells = token.header.map((cell) => renderInline(cell));
  rows.push("| " + headerCells.join(" | ") + " |");
  rows.push("| " + token.header.map(() => "---").join(" | ") + " |");

  for (const row of token.rows) {
    const cells = row.map((cell) => renderInline(cell));
    rows.push("| " + cells.join(" | ") + " |");
  }

  return rows.join("\n") + "\n";
}
