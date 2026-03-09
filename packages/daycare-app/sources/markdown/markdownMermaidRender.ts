import { renderMermaidAscii } from "beautiful-mermaid";

/**
 * Renders Mermaid source into ASCII art for native-safe markdown views.
 * Returns null when the Mermaid source cannot be parsed.
 */
export function markdownMermaidRender(source: string): string | null {
    try {
        return renderMermaidAscii(source);
    } catch {
        return null;
    }
}
