import type { ChatMarkdownSpan } from "./chatMarkdownTypes";

const pattern = /(\*\*(.*?)(?:\*\*|$))|(\*(.*?)(?:\*|$))|(\[([^\]]+)\](?:\(([^)]+)\))?)|(`(.*?)(?:`|$))/g;

/**
 * Parses inline markdown spans used by chat messages.
 * Expects: markdown is a single line or pre-trimmed block fragment.
 */
export function chatMarkdownSpansParse(markdown: string, header: boolean): ChatMarkdownSpan[] {
    const spans: ChatMarkdownSpan[] = [];
    let lastIndex = 0;
    pattern.lastIndex = 0;
    let match = pattern.exec(markdown);

    while (match !== null) {
        const plainText = markdown.slice(lastIndex, match.index);
        if (plainText) {
            spans.push({ styles: [], text: plainText, url: null });
        }

        if (match[1]) {
            spans.push({ styles: header ? [] : ["bold"], text: match[2], url: null });
        } else if (match[3]) {
            spans.push({ styles: header ? [] : ["italic"], text: match[4], url: null });
        } else if (match[5]) {
            if (match[7]) {
                spans.push({ styles: [], text: match[6], url: match[7] });
            } else {
                spans.push({ styles: [], text: `[${match[6]}]`, url: null });
            }
        } else if (match[8]) {
            spans.push({ styles: ["code"], text: match[9], url: null });
        }

        lastIndex = pattern.lastIndex;
        match = pattern.exec(markdown);
    }

    if (lastIndex < markdown.length) {
        spans.push({ styles: [], text: markdown.slice(lastIndex), url: null });
    }

    return spans;
}
