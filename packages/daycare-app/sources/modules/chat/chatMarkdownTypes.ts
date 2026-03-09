export type ChatMarkdownBlock =
    | {
          type: "text";
          content: ChatMarkdownSpan[];
      }
    | {
          type: "header";
          level: 1 | 2 | 3 | 4 | 5 | 6;
          content: ChatMarkdownSpan[];
      }
    | {
          type: "list";
          items: ChatMarkdownSpan[][];
      }
    | {
          type: "numbered-list";
          items: { number: number; spans: ChatMarkdownSpan[] }[];
      }
    | {
          type: "code-block";
          language: string | null;
          content: string;
      }
    | {
          type: "mermaid";
          content: string;
      }
    | {
          type: "horizontal-rule";
      }
    | {
          type: "options";
          items: string[];
      }
    | {
          type: "table";
          headers: string[];
          rows: string[][];
      };

export type ChatMarkdownSpan = {
    styles: ("italic" | "bold" | "semibold" | "code")[];
    text: string;
    url: string | null;
};
