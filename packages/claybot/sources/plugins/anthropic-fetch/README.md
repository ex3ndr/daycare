# Anthropic Fetch Plugin

Web fetch tool powered by Claude with URL content extraction.

## Tool

- **anthropic_fetch** (configurable via `toolName` setting)

## Parameters

| Parameter   | Type   | Required | Description                                     |
|-------------|--------|----------|-------------------------------------------------|
| url         | string | yes      | The URL to fetch content from                   |
| instruction | string | no       | Optional instruction for processing the content |

## Settings

| Setting   | Type   | Default                    | Description         |
|-----------|--------|----------------------------|---------------------|
| toolName  | string | anthropic_fetch            | Name of the tool    |
| model     | string | claude-sonnet-4-20250514   | Claude model to use |

## Authentication

Reuses existing Anthropic provider credentials. If the `anthropic` provider is configured, no additional setup is needed.

Falls back to prompting for an API key if the Anthropic provider is not configured.

## Response

Returns extracted and summarized content from the specified URL.
