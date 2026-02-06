# Anthropic Search Plugin

Web search tool powered by Claude with web search capability.

## Tool

- **anthropic_search** (configurable via `toolName` setting)

## Parameters

| Parameter | Type   | Required | Description       |
|-----------|--------|----------|-------------------|
| query     | string | yes      | The search query  |

## Settings

| Setting   | Type   | Default                    | Description         |
|-----------|--------|----------------------------|---------------------|
| toolName  | string | anthropic_search           | Name of the tool    |
| model     | string | claude-sonnet-4-20250514   | Claude model to use |

## Authentication

Reuses existing Anthropic provider credentials. If the `anthropic` provider is configured, no additional setup is needed.

Falls back to prompting for an API key if the Anthropic provider is not configured.

## Response

Returns an AI-generated answer with web search results integrated.
