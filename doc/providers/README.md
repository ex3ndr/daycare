# Providers

Providers are built-in modules that register inference and/or image generation capabilities. They are configured in `.daycare/settings.json` and authenticated via `.daycare/auth.json`.

## Configuration

Providers are listed in priority order in settings:

```json
{
  "providers": [
    { "id": "anthropic", "enabled": true, "model": "claude-sonnet-4-5" },
    { "id": "openai", "enabled": true, "model": "gpt-4o" }
  ]
}
```

- `daycare add` stores providers in priority order; disabled providers are skipped
- `daycare providers` moves a selected provider to the top of the priority list
- `daycare doctor` runs basic inference checks for configured providers

## Model selection

Each model has a size classification: `small`, `normal`, or `large`. The inference router uses strategies to select models:

| Strategy | Fallback order |
|----------|---------------|
| `default` | Use provider defaults from settings |
| `small` | small -> normal -> large |
| `normal` | normal -> large -> small |
| `large` | large -> normal -> small |

## Authentication types

| Type | Description |
|------|-------------|
| `apiKey` | API key stored in auth.json |
| `oauth` | OAuth with refresh/access tokens |
| `mixed` | Supports both apiKey and OAuth |
| `none` | No authentication needed (e.g. local endpoints) |

## Available providers

| Provider | Auth | Capabilities | Details |
|----------|------|-------------|---------|
| [Anthropic](anthropic.md) | mixed | Inference | Claude model family |
| [OpenAI](openai.md) | apiKey | Inference, Image | GPT and o-series models |
| [Google](google.md) | apiKey | Inference | Gemini model family |
| [Groq](groq.md) | apiKey | Inference | Fast inference for open models |
| [Mistral](mistral.md) | apiKey | Inference | Mistral, Codestral, Devstral |
| [xAI](xai.md) | apiKey | Inference | Grok model family |
| [Amazon Bedrock](bedrock.md) | none | Inference | Multi-vendor models via AWS |
| [OpenRouter](openrouter.md) | apiKey | Inference | Model aggregator (100+ models) |
| [Azure OpenAI](azure-openai.md) | apiKey | Inference | OpenAI models via Azure |
| [GitHub Copilot](github-copilot.md) | oauth | Inference | Multi-vendor via Copilot |
| [OpenAI Codex](openai-codex.md) | oauth | Inference | Codex-optimized models |
| [Google Gemini CLI](google-gemini-cli.md) | oauth | Inference | Gemini via Cloud Code Assist |
| [Google Antigravity](google-antigravity.md) | oauth | Inference | Multi-vendor via Google |
| [Vertex AI](vertex-ai.md) | none | Inference | Gemini via Google Cloud |
| [Vercel AI Gateway](vercel-ai.md) | apiKey | Inference | Multi-vendor via Vercel |
| [Cerebras](cerebras.md) | apiKey | Inference | Fast inference |
| [MiniMax](minimax.md) | apiKey | Inference | MiniMax models |
| [Kimi For Coding](kimi-coding.md) | apiKey | Inference | Kimi K2 models |
| [HuggingFace](huggingface.md) | apiKey | Inference | Open models via HF |
| [OpenCode](opencode.md) | apiKey | Inference | Multi-vendor gateway |
| [Z.AI](zai.md) | apiKey | Inference | GLM model family |
| [MiniMax CN](minimax-cn.md) | apiKey | Inference | MiniMax (China endpoint) |
| [OpenAI Compatible](openai-compatible.md) | apiKey | Inference | Any OpenAI-compatible endpoint |

## Plugin-based tools

These are not inference providers but plugin tools that use external APIs for web search/fetch:

| Plugin | Tool | Description |
|--------|------|-------------|
| `brave-search` | `web_search` | Brave Search API |
| `anthropic-search` | `anthropic_search` | Claude-powered web search |
| `openai-search` | `openai_search` | GPT-powered web search |
| `gemini-search` | `gemini_search` | Gemini with Search Grounding |
| `perplexity-search` | `perplexity_search` | Perplexity Sonar search |
| `exa-ai` | `exa_search` | Neural/fast/deep search |
| `anthropic-fetch` | `anthropic_fetch` | URL extraction via Claude |
| `firecrawl` | `firecrawl_fetch` | Content extraction via Firecrawl |
| `web-fetch` | `web_fetch` | Plain HTTP GET |

## Image generation

| Plugin | Description |
|--------|-------------|
| `nano-banana-pro` | Image generation (uses Google API key) |
| OpenAI (built-in) | Image generation via DALL-E |

## Media analysis

| Plugin | Description |
|--------|-------------|
| `media-analysis` | Analyze image/video/audio/pdf files via Gemini (uses Google API key) |
