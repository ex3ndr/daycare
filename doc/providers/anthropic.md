# Anthropic

Claude model family from Anthropic. Supports both API key and OAuth authentication.

## Authentication

- **Type:** mixed (apiKey or OAuth)
- **Auth key:** `anthropic`

```json
// API key
{ "anthropic": { "type": "apiKey", "apiKey": "sk-ant-..." } }

// OAuth
{ "anthropic": { "type": "oauth", "refreshToken": "...", "accessToken": "..." } }
```

## Models

| Model ID | Name | Size |
|----------|------|------|
| `claude-opus-4-5` | Claude Opus 4.5 (latest) | large |
| `claude-sonnet-4-5` | Claude Sonnet 4.5 (latest) | normal |
| `claude-haiku-4-5` | Claude Haiku 4.5 (latest) | small |
| `claude-opus-4-1` | Claude Opus 4.1 (latest) | large |
| `claude-opus-4-0` | Claude Opus 4 (latest) | large |
| `claude-sonnet-4-0` | Claude Sonnet 4 (latest) | normal |
| `claude-opus-4-5-20251101` | Claude Opus 4.5 | large |
| `claude-haiku-4-5-20251001` | Claude Haiku 4.5 | small |
| `claude-sonnet-4-5-20250929` | Claude Sonnet 4.5 | normal |

Pinned versions are also available for older generations (3.5, 3.7, etc.).

## Related plugins

- `anthropic-search` - Web search using Claude
- `anthropic-fetch` - URL content extraction using Claude

Both plugins reuse the Anthropic provider credentials automatically.
