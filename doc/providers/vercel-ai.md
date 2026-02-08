# Vercel AI Gateway

Multi-vendor model access via Vercel's AI Gateway.

## Authentication

- **Type:** apiKey
- **Auth key:** `vercel-ai-gateway`

## Models

Vercel AI Gateway provides access to models from many vendors. Highlights:

### OpenAI
`openai/gpt-5.2`, `openai/gpt-5.2-codex`, `openai/gpt-5.2-pro`, `openai/o3`, `openai/o4-mini`

### Anthropic
`anthropic/claude-opus-4.5`, `anthropic/claude-sonnet-4.5`, `anthropic/claude-haiku-4.5`

### Google
`google/gemini-3-pro-preview`, `google/gemini-3-flash`, `google/gemini-2.5-pro`

### xAI
`xai/grok-4`, `xai/grok-4.1-fast-reasoning`, `xai/grok-3`, `xai/grok-3-mini`

### Meta
`meta/llama-4-maverick`, `meta/llama-4-scout`, `meta/llama-3.3-70b`

### DeepSeek
`deepseek/deepseek-v3.2-exp`, `deepseek/deepseek-v3.1-terminus`

### Others
Z.AI (GLM), Qwen, MiniMax, MoonShot, Mistral, ByteDance, Cohere, NVIDIA, Perplexity, and Vercel's own v0 models.

Use `daycare add` to browse the full catalog.
