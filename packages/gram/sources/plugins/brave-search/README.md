# Brave Search plugin

## Overview
The Brave Search plugin registers a single tool that queries the Brave Search API and returns concise text results.
It is intended for on-demand web lookups during inference.

## Files
- `plugin.ts` - registers the tool and handles onboarding/auth.

## Settings
- `toolName` (optional): overrides the default tool name (`web_search`).

## Auth
- During onboarding, the plugin prompts for a Brave Search API key and stores it in the auth store under the plugin instance id.
- The tool fetches the API key on each execution.

## Tool behavior
- Tool name: `web_search` (or the configured `toolName`).
- Parameters:
  - `query` (string, required)
  - `count` (number, optional, 1-10)
  - `country` (string, optional)
  - `language` (string, optional)
  - `safeSearch` (boolean, optional)
- Execution:
  - Calls `https://api.search.brave.com/res/v1/web/search` with the query parameters.
  - Maps the top results to a numbered list with title, URL, and description.
  - Returns a `toolResult` message containing the formatted text and a `details.count` field.

## Error handling
- If the API key is missing, the tool throws an error.
- Non-2xx responses from Brave Search raise an error with the HTTP status.
