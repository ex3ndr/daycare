# OpenAI

GPT and o-series models from OpenAI. Supports inference and image generation.

## Authentication

- **Type:** apiKey
- **Auth key:** `openai`

```json
{ "openai": { "type": "apiKey", "apiKey": "sk-..." } }
```

## Models

| Model ID | Name | Size |
|----------|------|------|
| `gpt-5.2` | GPT-5.2 | normal |
| `gpt-5.2-codex` | GPT-5.2 Codex | normal |
| `gpt-5.2-pro` | GPT-5.2 Pro | normal |
| `gpt-5.1-codex-max` | GPT-5.1 Codex Max | normal |
| `gpt-5.1-codex-mini` | GPT-5.1 Codex mini | normal |
| `gpt-5-mini` | GPT-5 Mini | normal |
| `gpt-5-nano` | GPT-5 Nano | normal |
| `gpt-4o` | GPT-4o | normal |
| `gpt-4o-mini` | GPT-4o mini | normal |
| `gpt-4-turbo` | GPT-4 Turbo | normal |
| `o4-mini` | o4-mini | normal |
| `o3` | o3 | normal |
| `o3-pro` | o3-pro | normal |
| `o3-mini` | o3-mini | normal |
| `o1` | o1 | normal |
| `codex-mini-latest` | Codex Mini | normal |

## Image generation

OpenAI also provides image generation via DALL-E. When enabled, the `generate_image` tool becomes available to agents.

## Related plugins

- `openai-search` - Web search using GPT (reuses OpenAI credentials)
