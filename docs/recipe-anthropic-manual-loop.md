# Recipe: Anthropic Manual Loop

Adds a new `sources/recipe` folder with a runnable TypeScript recipe list in `packages/daycare/sources/recipe/_recipes.ts`.

Current runnable recipe:
- `sources/recipe/recipeAnthropicManualLoop.ts`

This recipe:
- reads Anthropic OAuth credentials from `~/.dev/auth.json`
- refreshes OAuth credentials via `getOAuthApiKey(...)`
- prompts user input with Enquirer
- sends chat turns using `@mariozechner/pi-ai` (`complete(getModel("anthropic", ...), ...)`) with `tools: []`

```mermaid
flowchart TD
  U[User Input via Enquirer] --> L[recipeAnthropicManualLoop]
  L --> A[Read ~/.dev/auth.json]
  A --> O[Resolve OAuth API key]
  O --> W[Write refreshed oauth credentials]
  W --> I[pi-ai complete(model, context, apiKey)]
  I --> R[Print assistant reply]
  R --> U
```
