# OpenAI Search Plugin

Web search tool powered by GPT with web search capability.

## Tool

- **openai_search** (configurable via `toolName` setting)

## Parameters

| Parameter | Type   | Required | Description       |
|-----------|--------|----------|-------------------|
| query     | string | yes      | The search query  |

## Settings

| Setting   | Type   | Default        | Description       |
|-----------|--------|----------------|-------------------|
| toolName  | string | openai_search  | Name of the tool  |
| model     | string | gpt-4o         | GPT model to use  |

## Authentication

Reuses existing OpenAI provider credentials. If the `openai` provider is configured, no additional setup is needed.

Falls back to prompting for an API key if the OpenAI provider is not configured.

## Response

Returns an AI-generated answer with source citations from web search.
