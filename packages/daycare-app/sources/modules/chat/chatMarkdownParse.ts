import { chatMarkdownBlockParse } from "./chatMarkdownBlockParse";
import type { ChatMarkdownBlock } from "./chatMarkdownTypes";

/**
 * Parses raw assistant markdown into renderable chat blocks.
 * Expects: markdown is the joined assistant text content.
 */
export function chatMarkdownParse(markdown: string): ChatMarkdownBlock[] {
    return chatMarkdownBlockParse(markdown);
}
