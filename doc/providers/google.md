# Google

Gemini model family from Google.

## Authentication

- **Type:** apiKey
- **Auth key:** `google`

```json
{ "google": { "type": "apiKey", "apiKey": "AIza..." } }
```

## Models

| Model ID | Name | Size |
|----------|------|------|
| `gemini-flash-latest` | Gemini Flash Latest | small |
| `gemini-flash-lite-latest` | Gemini Flash-Lite Latest | small |
| `gemini-3-pro-preview` | Gemini 3 Pro Preview | normal |
| `gemini-3-flash-preview` | Gemini 3 Flash Preview | small |
| `gemini-2.5-pro` | Gemini 2.5 Pro | normal |
| `gemini-2.5-flash` | Gemini 2.5 Flash | small |
| `gemini-2.5-flash-lite` | Gemini 2.5 Flash Lite | small |
| `gemini-live-2.5-flash` | Gemini Live 2.5 Flash | small |
| `gemini-1.5-flash-8b` | Gemini 1.5 Flash-8B | small |

## Related plugins

- `gemini-search` - Web search using Gemini with Search Grounding (reuses Google credentials)
- `nano-banana-pro` - Image generation (reuses Google API key)
- `gemini-media` - Multi-modal media analysis (reuses Google API key)
