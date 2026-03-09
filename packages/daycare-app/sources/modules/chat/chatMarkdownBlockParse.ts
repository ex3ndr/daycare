import { chatMarkdownSpansParse } from "./chatMarkdownSpansParse";
import type { ChatMarkdownBlock } from "./chatMarkdownTypes";

function tableParse(lines: string[], startIndex: number): { table: ChatMarkdownBlock | null; nextIndex: number } {
    let index = startIndex;
    const tableLines: string[] = [];

    while (index < lines.length && lines[index].includes("|")) {
        tableLines.push(lines[index]);
        index++;
    }

    if (tableLines.length < 2) {
        return { table: null, nextIndex: startIndex };
    }

    const separatorLine = tableLines[1].trim();
    const isSeparator = /^[|\s\-:=]*$/.test(separatorLine) && separatorLine.includes("-");
    if (!isSeparator) {
        return { table: null, nextIndex: startIndex };
    }

    const headers = tableLines[0]
        .trim()
        .split("|")
        .map((cell) => cell.trim())
        .filter((cell) => cell.length > 0);
    if (headers.length === 0) {
        return { table: null, nextIndex: startIndex };
    }

    const rows: string[][] = [];
    for (let rowIndex = 2; rowIndex < tableLines.length; rowIndex++) {
        const rowLine = tableLines[rowIndex].trim();
        if (!rowLine.startsWith("|")) {
            continue;
        }

        const rowCells = rowLine
            .split("|")
            .map((cell) => cell.trim())
            .filter((cell) => cell.length > 0);
        if (rowCells.length > 0) {
            rows.push(rowCells);
        }
    }

    return {
        table: {
            type: "table",
            headers,
            rows
        },
        nextIndex: index
    };
}

/**
 * Parses block-level markdown structures for chat messages.
 * Expects: markdown is raw message text and may contain lists, code fences, tables, and Mermaid blocks.
 */
export function chatMarkdownBlockParse(markdown: string): ChatMarkdownBlock[] {
    const blocks: ChatMarkdownBlock[] = [];
    const lines = markdown.split("\n");
    let index = 0;

    while (index < lines.length) {
        const line = lines[index];
        index++;

        let matchedHeader = false;
        for (let level = 1; level <= 6; level++) {
            if (line.startsWith(`${"#".repeat(level)} `)) {
                blocks.push({
                    type: "header",
                    level: level as 1 | 2 | 3 | 4 | 5 | 6,
                    content: chatMarkdownSpansParse(line.slice(level + 1).trim(), true)
                });
                matchedHeader = true;
                break;
            }
        }
        if (matchedHeader) {
            continue;
        }

        const trimmed = line.trim();

        if (trimmed.startsWith("```")) {
            const language = trimmed.slice(3).trim() || null;
            const content: string[] = [];
            while (index < lines.length) {
                const nextLine = lines[index];
                if (nextLine.trim() === "```") {
                    index++;
                    break;
                }
                content.push(nextLine);
                index++;
            }

            const contentString = content.join("\n");
            if (language === "mermaid") {
                blocks.push({ type: "mermaid", content: contentString });
            } else {
                blocks.push({ type: "code-block", language, content: contentString });
            }
            continue;
        }

        if (trimmed === "---") {
            blocks.push({ type: "horizontal-rule" });
            continue;
        }

        if (trimmed.startsWith("<options>")) {
            const items: string[] = [];
            while (index < lines.length) {
                const nextLine = lines[index];
                if (nextLine.trim() === "</options>") {
                    index++;
                    break;
                }
                const optionMatch = nextLine.match(/<option>(.*?)<\/option>/);
                if (optionMatch) {
                    items.push(optionMatch[1]);
                }
                index++;
            }
            if (items.length > 0) {
                blocks.push({ type: "options", items });
            }
            continue;
        }

        const numberedListMatch = trimmed.match(/^(\d+)\.\s/);
        if (numberedListMatch) {
            const items = [
                {
                    number: Number.parseInt(numberedListMatch[1], 10),
                    content: trimmed.slice(numberedListMatch[0].length)
                }
            ];
            while (index < lines.length) {
                const nextLine = lines[index].trim();
                const nextMatch = nextLine.match(/^(\d+)\.\s/);
                if (!nextMatch) {
                    break;
                }
                items.push({ number: Number.parseInt(nextMatch[1], 10), content: nextLine.slice(nextMatch[0].length) });
                index++;
            }
            blocks.push({
                type: "numbered-list",
                items: items.map((item) => ({
                    number: item.number,
                    spans: chatMarkdownSpansParse(item.content, false)
                }))
            });
            continue;
        }

        if (trimmed.startsWith("- ")) {
            const items = [trimmed.slice(2)];
            while (index < lines.length && lines[index].trim().startsWith("- ")) {
                items.push(lines[index].trim().slice(2));
                index++;
            }
            blocks.push({
                type: "list",
                items: items.map((item) => chatMarkdownSpansParse(item, false))
            });
            continue;
        }

        if (trimmed.includes("|")) {
            const { table, nextIndex } = tableParse(lines, index - 1);
            if (table) {
                blocks.push(table);
                index = nextIndex;
                continue;
            }
        }

        if (trimmed.length > 0) {
            blocks.push({
                type: "text",
                content: chatMarkdownSpansParse(trimmed, false)
            });
        }
    }

    return blocks;
}
