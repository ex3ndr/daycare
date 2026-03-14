import { Marked } from "marked";
import { markdownMermaidRender } from "@/markdown/markdownMermaidRender";

type ThemeColors = {
    onSurface: string;
    surface: string;
    onSurfaceVariant: string;
    outlineVariant: string;
    surfaceContainerHigh: string;
    primary: string;
};

/**
 * Converts markdown to a complete HTML document with themed styling.
 * Mermaid code blocks are rendered as ASCII art via beautiful-mermaid.
 *
 * Expects: markdown is a raw markdown string; colors come from the app theme.
 */
export function vaultMarkdownHtml(markdown: string, colors: ThemeColors): string {
    const marked = new Marked();

    const renderer = {
        code({ text, lang }: { text: string; lang?: string | null }) {
            if (lang === "mermaid") {
                const ascii = markdownMermaidRender(text);
                if (ascii) {
                    const escaped = ascii.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
                    return `<div class="mermaid-container"><pre><code>${escaped}</code></pre></div>`;
                }
            }
            const escaped = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
            return `<pre><code class="language-${lang || ""}">${escaped}</code></pre>`;
        }
    };

    marked.use({ renderer });
    const body = marked.parse(markdown) as string;

    return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    font-size: 15px;
    line-height: 1.6;
    color: ${colors.onSurface};
    background: ${colors.surface};
    padding: 20px;
    word-wrap: break-word;
    overflow-wrap: break-word;
}
h1, h2, h3, h4, h5, h6 {
    margin-top: 1.4em;
    margin-bottom: 0.6em;
    font-weight: 600;
    line-height: 1.3;
}
h1 { font-size: 1.7em; }
h2 { font-size: 1.4em; }
h3 { font-size: 1.2em; }
h4 { font-size: 1.05em; }
h1:first-child, h2:first-child, h3:first-child { margin-top: 0; }
p { margin-bottom: 0.8em; }
a { color: ${colors.primary}; text-decoration: none; }
a:hover { text-decoration: underline; }
code {
    font-family: "SF Mono", Monaco, Menlo, Consolas, monospace;
    font-size: 0.88em;
    background: ${colors.surfaceContainerHigh};
    padding: 2px 5px;
    border-radius: 4px;
}
pre {
    background: ${colors.surfaceContainerHigh};
    border-radius: 8px;
    padding: 14px;
    margin-bottom: 1em;
    overflow-x: auto;
}
pre code {
    background: none;
    padding: 0;
    font-size: 0.85em;
    line-height: 1.5;
}
blockquote {
    border-left: 3px solid ${colors.outlineVariant};
    padding-left: 14px;
    margin-bottom: 1em;
    color: ${colors.onSurfaceVariant};
}
ul, ol {
    margin-bottom: 1em;
    padding-left: 1.8em;
}
li { margin-bottom: 0.3em; }
table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 1em;
}
th, td {
    border: 1px solid ${colors.outlineVariant};
    padding: 8px 12px;
    text-align: left;
}
th {
    background: ${colors.surfaceContainerHigh};
    font-weight: 600;
}
hr {
    border: none;
    border-top: 1px solid ${colors.outlineVariant};
    margin: 1.5em 0;
}
img { max-width: 100%; height: auto; border-radius: 4px; }
.mermaid-container {
    margin-bottom: 1em;
    text-align: center;
    overflow-x: auto;
}
.mermaid-container svg {
    max-width: 100%;
    height: auto;
}
</style>
</head>
<body>${body}</body>
</html>`;
}
