# OpenRouter

Model aggregator providing access to 100+ models from multiple vendors through a single API.

## Authentication

- **Type:** apiKey
- **Auth key:** `openrouter`

```json
{ "openrouter": { "type": "apiKey", "apiKey": "sk-or-..." } }
```

## Models

OpenRouter offers the broadest model selection. Highlights by vendor:

### Anthropic
`anthropic/claude-opus-4.5`, `anthropic/claude-sonnet-4.5`, `anthropic/claude-haiku-4.5`

### OpenAI
`openai/gpt-5.2`, `openai/gpt-5.2-codex`, `openai/gpt-5-mini`, `openai/o3`, `openai/o4-mini`, `openai/gpt-4o`

### Google
`google/gemini-3-pro-preview`, `google/gemini-3-flash-preview`, `google/gemini-2.5-pro`, `google/gemini-2.5-flash`

### Meta
`meta-llama/llama-4-maverick`, `meta-llama/llama-4-scout`, `meta-llama/llama-3.3-70b-instruct`

### Mistral
`mistralai/devstral-2512`, `mistralai/mistral-large-2512`, `mistralai/codestral-2508`

### xAI
`x-ai/grok-4`, `x-ai/grok-4.1-fast`, `x-ai/grok-3-mini`

### Qwen
`qwen/qwen3-coder`, `qwen/qwen3-235b-a22b`, `qwen/qwen3-32b`

### DeepSeek
`deepseek/deepseek-v3.2`, `deepseek/deepseek-r1`, `deepseek/deepseek-v3.1-terminus`

### Others
Models from NVIDIA, Cohere, Amazon, MiniMax, MoonShot, AI21, ByteDance, Inception, and community fine-tunes.

Many models offer free tiers (`:free` suffix) and exact routing (`:exacto` suffix).

Use `daycare add` and select OpenRouter to browse the full catalog interactively.
