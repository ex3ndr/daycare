# Web Fetch Plugin

Minimal web fetch tool that downloads URL content without running JavaScript.

## Tool

- **web_fetch** (configurable via `toolName` setting)

## Parameters

| Parameter | Type   | Required | Description                            |
|-----------|--------|----------|----------------------------------------|
| url       | string | yes      | The URL to fetch content from          |
| maxChars  | number | no       | Max characters to return (default 20000) |
| timeoutMs | number | no       | Request timeout in ms (default 15000)  |

## Settings

| Setting  | Type   | Default   | Description       |
|----------|--------|-----------|-------------------|
| toolName | string | web_fetch | Name of the tool  |

## Authentication

No authentication required.

## Response

Returns the HTTP status, content type, and fetched content (truncated to `maxChars`).
