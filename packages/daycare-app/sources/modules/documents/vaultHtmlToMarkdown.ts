/**
 * Converts HTML content back to markdown.
 * Handles common elements: headers, paragraphs, bold, italic, lists, links, code, blockquotes, hrs.
 *
 * Expects: html is a string of HTML content (not a full document, just body innerHTML).
 */
export function vaultHtmlToMarkdown(html: string): string {
    // Use DOMParser on web to parse the HTML
    if (typeof DOMParser === "undefined") {
        // Fallback for non-web: strip tags and return plain text
        return html.replace(/<[^>]+>/g, "");
    }

    const doc = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html");
    const root = doc.body.firstElementChild;
    if (!root) return "";

    return nodeToMarkdown(root).trim();
}

function nodeToMarkdown(node: Node): string {
    if (node.nodeType === Node.TEXT_NODE) {
        return node.textContent ?? "";
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
        return "";
    }

    const el = node as Element;
    const tag = el.tagName.toLowerCase();
    const children = childrenToMarkdown(el);

    switch (tag) {
        case "h1":
            return `# ${children.trim()}\n\n`;
        case "h2":
            return `## ${children.trim()}\n\n`;
        case "h3":
            return `### ${children.trim()}\n\n`;
        case "h4":
            return `#### ${children.trim()}\n\n`;
        case "h5":
            return `##### ${children.trim()}\n\n`;
        case "h6":
            return `###### ${children.trim()}\n\n`;
        case "p":
            return `${children.trim()}\n\n`;
        case "br":
            return "\n";
        case "strong":
        case "b":
            return `**${children}**`;
        case "em":
        case "i":
            return `*${children}*`;
        case "u":
            return children;
        case "del":
        case "s":
            return `~~${children}~~`;
        case "a": {
            const href = el.getAttribute("href") ?? "";
            return `[${children}](${href})`;
        }
        case "code": {
            // Check if parent is <pre> - handled by pre case
            if (el.parentElement?.tagName.toLowerCase() === "pre") {
                return children;
            }
            return `\`${children}\``;
        }
        case "pre": {
            const codeEl = el.querySelector("code");
            const lang = codeEl?.className?.replace("language-", "") ?? "";
            const text = codeEl?.textContent ?? el.textContent ?? "";
            return `\`\`\`${lang}\n${text}\n\`\`\`\n\n`;
        }
        case "blockquote":
            return `${children
                .trim()
                .split("\n")
                .map((line) => `> ${line}`)
                .join("\n")}\n\n`;
        case "ul":
            return `${listToMarkdown(el, "ul")}\n`;
        case "ol":
            return `${listToMarkdown(el, "ol")}\n`;
        case "li":
            return children.trim();
        case "hr":
            return "---\n\n";
        case "img": {
            const alt = el.getAttribute("alt") ?? "";
            const src = el.getAttribute("src") ?? "";
            return `![${alt}](${src})`;
        }
        case "table":
            return `${tableToMarkdown(el)}\n\n`;
        case "div":
            return children;
        default:
            return children;
    }
}

function childrenToMarkdown(el: Element): string {
    let result = "";
    for (const child of Array.from(el.childNodes)) {
        result += nodeToMarkdown(child);
    }
    return result;
}

function listToMarkdown(el: Element, type: "ul" | "ol"): string {
    const items: string[] = [];
    let index = 1;
    for (const child of Array.from(el.children)) {
        if (child.tagName.toLowerCase() === "li") {
            const prefix = type === "ul" ? "- " : `${index}. `;
            items.push(`${prefix}${nodeToMarkdown(child).trim()}`);
            index++;
        }
    }
    return `${items.join("\n")}\n`;
}

function tableToMarkdown(el: Element): string {
    const rows: string[][] = [];
    const headerRow: string[] = [];

    const thead = el.querySelector("thead");
    const tbody = el.querySelector("tbody") ?? el;

    if (thead) {
        for (const th of Array.from(thead.querySelectorAll("th"))) {
            headerRow.push(nodeToMarkdown(th).trim());
        }
    }

    const bodyRows = Array.from(tbody.querySelectorAll("tr"));
    for (const tr of bodyRows) {
        const cells: string[] = [];
        const cellEls = Array.from(tr.querySelectorAll("td, th"));
        for (const cellEl of cellEls) {
            cells.push(nodeToMarkdown(cellEl).trim());
        }
        if (cells.length > 0) {
            const isHeaderRow = cellEls.every((c) => c.tagName.toLowerCase() === "th");
            if (headerRow.length === 0 && rows.length === 0 && isHeaderRow) {
                headerRow.push(...cells);
            } else {
                rows.push(cells);
            }
        }
    }

    if (headerRow.length === 0 && rows.length === 0) return "";

    const cols = Math.max(headerRow.length, ...rows.map((r) => r.length));
    const header = headerRow.length > 0 ? headerRow : (rows.shift() ?? []);
    const separator = Array(cols).fill("---");

    const lines: string[] = [];
    lines.push(`| ${padRow(header, cols).join(" | ")} |`);
    lines.push(`| ${separator.join(" | ")} |`);
    for (const row of rows) {
        lines.push(`| ${padRow(row, cols).join(" | ")} |`);
    }

    return lines.join("\n");
}

function padRow(cells: string[], cols: number): string[] {
    const result = [...cells];
    while (result.length < cols) {
        result.push("");
    }
    return result;
}
