# Amazon Bedrock

Multi-vendor model access via AWS Bedrock. Supports models from Anthropic, Meta, Mistral, Qwen, Amazon, and more.

## Authentication

- **Type:** none (uses AWS credentials from environment)

No API key needed. Bedrock uses standard AWS credential resolution (environment variables, IAM roles, etc.).

## Models

Bedrock offers the largest model catalog. Key models include:

### Anthropic (Claude)

| Model ID | Name | Size |
|----------|------|------|
| `global.anthropic.claude-opus-4-5-20251101-v1:0` | Claude Opus 4.5 | large |
| `global.anthropic.claude-sonnet-4-5-20250929-v1:0` | Claude Sonnet 4.5 | normal |
| `global.anthropic.claude-haiku-4-5-20251001-v1:0` | Claude Haiku 4.5 | small |

### Meta (Llama)

| Model ID | Name | Size |
|----------|------|------|
| `us.meta.llama4-maverick-17b-instruct-v1:0` | Llama 4 Maverick 17B | normal |
| `us.meta.llama4-scout-17b-instruct-v1:0` | Llama 4 Scout 17B | normal |
| `us.meta.llama3-3-70b-instruct-v1:0` | Llama 3.3 70B | normal |

### Amazon (Nova)

| Model ID | Name | Size |
|----------|------|------|
| `global.amazon.nova-2-lite-v1:0` | Nova 2 Lite | normal |
| `us.amazon.nova-premier-v1:0` | Nova Premier | normal |
| `us.amazon.nova-pro-v1:0` | Nova Pro | normal |

### Other vendors

Qwen, Mistral, DeepSeek, Google Gemma, Cohere, MiniMax, MoonShot, and NVIDIA models are also available. Use `daycare add` to see the full catalog.

EU-region variants are available for many models (e.g. `eu.anthropic.claude-*`).
