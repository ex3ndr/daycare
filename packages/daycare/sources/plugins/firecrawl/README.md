# Firecrawl Plugin

Web fetch tool powered by Firecrawl for extracting clean content from URLs.

## Tool

- **firecrawl_fetch** (configurable via `toolName` setting)

## Parameters

| Parameter       | Type     | Required | Description                                    |
|-----------------|----------|----------|------------------------------------------------|
| url             | string   | yes      | The URL to fetch content from                  |
| formats         | string[] | no       | Output formats: markdown, html, rawHtml        |
| onlyMainContent | boolean  | no       | Extract only main content (default true)       |
| waitFor         | number   | no       | Time in ms to wait for page load (0-30000)     |

## Settings

| Setting  | Type   | Default         | Description       |
|----------|--------|-----------------|-------------------|
| toolName | string | firecrawl_fetch | Name of the tool  |

## Authentication

Requires a Firecrawl API key stored via the auth store.

## Response

Returns page content in the requested format (default: markdown) with metadata.
