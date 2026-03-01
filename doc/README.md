# Daycare Documentation

## References

- [Storage Types Reference](STORAGE.md) - Complete persistence-layer types, schemas, paths, and diagrams

## Concepts

Core concepts and systems that power Daycare.

- [Agents](concepts/agents.md) - Per-channel message sequencing, agent types, persistence
- [Cron](concepts/cron.md) - Scheduled task execution with cron expressions
- [Signals](concepts/signals.md) - Broadcast event system for multi-agent coordination
- [Apps](concepts/apps.md) - LLM-reviewed sandboxed app tools discovered from workspace
- [Sandboxes](concepts/sandboxes.md) - Filesystem and network sandboxing, durable processes
- [Networking & Permissions](concepts/networking.md) - Permission system, web search/fetch tools
- [Memory](concepts/memory.md) - Structured entity storage as Markdown
- [Skills](concepts/skills.md) - Opt-in prompt files for agent capabilities

## Providers

Inference and image generation providers. See the [providers overview](providers/README.md) for configuration and model selection.

### Direct API providers

| Provider | Auth | Models |
|----------|------|--------|
| [Anthropic](providers/anthropic.md) | mixed | Claude Opus/Sonnet/Haiku 4.5 |
| [OpenAI](providers/openai.md) | apiKey | GPT-5.x, o3/o4, GPT-4o |
| [Google](providers/google.md) | apiKey | Gemini 3/2.5 |
| [Mistral](providers/mistral.md) | apiKey | Mistral, Codestral, Devstral |
| [xAI](providers/xai.md) | apiKey | Grok 4.x, 3.x |
| [Groq](providers/groq.md) | apiKey | Llama, Qwen, Gemma (fast) |
| [Cerebras](providers/cerebras.md) | apiKey | Qwen, GPT-OSS, GLM |
| [MiniMax](providers/minimax.md) | apiKey | MiniMax M2.x |
| [Kimi For Coding](providers/kimi-coding.md) | apiKey | Kimi K2.x |
| [Z.AI](providers/zai.md) | apiKey | GLM 4.x |
| [HuggingFace](providers/huggingface.md) | apiKey | Open models via HF |

### Cloud platform providers

| Provider | Auth | Models |
|----------|------|--------|
| [Amazon Bedrock](providers/bedrock.md) | none (AWS) | 70+ multi-vendor models |
| [Vertex AI](providers/vertex-ai.md) | none (GCP) | Gemini models |
| [Azure OpenAI](providers/azure-openai.md) | apiKey | OpenAI models via Azure |

### Gateway providers

| Provider | Auth | Models |
|----------|------|--------|
| [OpenRouter](providers/openrouter.md) | apiKey | 100+ models from all vendors |
| [Vercel AI Gateway](providers/vercel-ai.md) | apiKey | Multi-vendor |
| [GitHub Copilot](providers/github-copilot.md) | oauth | Multi-vendor via Copilot |
| [OpenCode](providers/opencode.md) | apiKey | Multi-vendor gateway |
| [Zen](providers/zen.md) | apiKey | OpenCode Zen gateway |
| [Google Antigravity](providers/google-antigravity.md) | oauth | Multi-vendor via Google |
| [Google Gemini CLI](providers/google-gemini-cli.md) | oauth | Gemini via Cloud Code Assist |
| [OpenAI Codex](providers/openai-codex.md) | oauth | Codex-optimized models |
| [OpenAI Compatible](providers/openai-compatible.md) | apiKey | Any compatible endpoint |

## Connectors

Messaging platform integrations.

- [Telegram](connectors/telegram.md) - Bot API with long polling, MarkdownV2, inline permissions
- [WhatsApp](connectors/whatsapp.md) - Baileys WebSocket, QR code auth, text-based permissions

## Internals

Low-level implementation documentation is in [internals/](internals/).
