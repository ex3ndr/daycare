# Gemini Search Plugin

Web search tool powered by Google Gemini with Search Grounding.

## Tool

- **gemini_search** (configurable via `toolName` setting)

## Parameters

| Parameter | Type   | Required | Description       |
|-----------|--------|----------|-------------------|
| query     | string | yes      | The search query  |

## Settings

| Setting   | Type   | Default          | Description                  |
|-----------|--------|------------------|------------------------------|
| toolName  | string | gemini_search    | Name of the tool             |
| model     | string | gemini-2.0-flash | Gemini model to use          |

## Authentication

Reuses existing Google provider credentials. If the `google` provider is configured, no additional setup is needed.

Falls back to prompting for an API key if the Google provider is not configured.

## Response

Returns an AI-generated answer with grounded sources from Google Search.
