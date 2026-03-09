import { describe, expect, it } from "vitest";
import { chatMarkdownParse } from "./chatMarkdownParse";

describe("chatMarkdownParse", () => {
    it("parses headers and inline styles", () => {
        const blocks = chatMarkdownParse("# Title\nHello **bold** and *italic* with `code`.");
        expect(blocks).toEqual([
            {
                type: "header",
                level: 1,
                content: [{ styles: [], text: "Title", url: null }]
            },
            {
                type: "text",
                content: [
                    { styles: [], text: "Hello ", url: null },
                    { styles: ["bold"], text: "bold", url: null },
                    { styles: [], text: " and ", url: null },
                    { styles: ["italic"], text: "italic", url: null },
                    { styles: [], text: " with ", url: null },
                    { styles: ["code"], text: "code", url: null },
                    { styles: [], text: ".", url: null }
                ]
            }
        ]);
    });

    it("parses lists, numbered lists, and links", () => {
        const blocks = chatMarkdownParse("- one\n- [two](https://example.com)\n\n1. first\n2. second");
        expect(blocks).toEqual([
            {
                type: "list",
                items: [
                    [{ styles: [], text: "one", url: null }],
                    [{ styles: [], text: "two", url: "https://example.com" }]
                ]
            },
            {
                type: "numbered-list",
                items: [
                    { number: 1, spans: [{ styles: [], text: "first", url: null }] },
                    { number: 2, spans: [{ styles: [], text: "second", url: null }] }
                ]
            }
        ]);
    });

    it("parses code, mermaid, tables, and options", () => {
        const blocks = chatMarkdownParse(
            [
                "```ts",
                "const a = 1;",
                "```",
                "```mermaid",
                "graph TD;",
                "```",
                "| Name | Value |",
                "| --- | --- |",
                "| One | 1 |",
                "<options>",
                "<option>Try again</option>",
                "</options>"
            ].join("\n")
        );

        expect(blocks).toEqual([
            { type: "code-block", language: "ts", content: "const a = 1;" },
            { type: "mermaid", content: "graph TD;" },
            { type: "table", headers: ["Name", "Value"], rows: [["One", "1"]] },
            { type: "options", items: ["Try again"] }
        ]);
    });
});
