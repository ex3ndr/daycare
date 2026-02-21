# PDF Process Tool

Added a new core system tool: `pdf_process`.

## What It Does

- Accepts a local PDF path with standard read permissions.
- Extracts text from up to `maxPages` pages using `engine/modules/media/pdfExtract.ts` backed by `pdfjs-dist`.
- If extracted text is below `minTextChars` and `includeImagesWhenTextMissing` is enabled, renders PDF pages to PNG and returns them as image content blocks.
- Keeps output bounded with `maxChars` text clamping.

## Defaults

- `maxPages`: `4`
- `maxPixels`: `4_000_000`
- `minTextChars`: `200`
- `maxChars`: `20_000`

## Runtime Flow

```mermaid
flowchart TD
    A[pdf_process(path,...)] --> B[Resolve + permission-check path]
    B --> C[Secure open + verify PDF header]
    C --> D[media/pdfExtract: page text]
    D --> E{Enough text?}
    E -->|Yes| F[Return text result]
    E -->|No| G{Image fallback enabled?}
    G -->|No| F
    G -->|Yes| H[Try load @napi-rs/canvas]
    H --> I[media/pdfExtract: render pages to PNG]
    I --> J[Return text + image blocks]
    H -->|Load fails| F
```
