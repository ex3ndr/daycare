# OpenAI Compatible

Generic provider for any OpenAI-compatible API endpoint.

## Authentication

- **Type:** apiKey (optional)
- **Auth key:** user-defined

## Configuration

During `daycare add`, you configure:
- **Base URL** - the API endpoint
- **Model ID** - model identifier
- **API key** - optional authentication

This provider is useful for:
- Self-hosted models (llama.cpp, vLLM, Ollama, etc.)
- Third-party API gateways
- Custom inference endpoints

## Models

No predefined model catalog. You specify the model ID during setup.
