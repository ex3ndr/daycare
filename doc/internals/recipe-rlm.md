# Recipe: RLM

Adds a runnable recipe system with:
- `yarn recipe <name>` entrypoint (`packages/daycare/sources/recipe/recipeRun.ts`)
- recipe registry (`packages/daycare/sources/recipe/_recipes.ts`)
- recipe-specific utilities in `packages/daycare/sources/recipe/utils`

Current runnable recipe:
- `sources/recipe/recipeRlm.ts` (`id: rlm`)

Run from repo root:
- `yarn recipe rlm`

RLM recipe behavior:
- prompts user input with Enquirer
- resolves Anthropic OAuth credentials from `~/.dev/auth.json` via recipe utils
- resolves API key via existing `apiKey` or `getOAuthApiKey(...)`
- sends turns via `@mariozechner/pi-ai` with `tools: []`

```mermaid
flowchart TD
  C[yarn recipe rlm] --> R[recipeRun main(args)]
  R --> L[recipeRlm main(args)]
  U[User Input via Enquirer] --> L
  L --> A[recipe utils: resolve Anthropic API key]
  A --> I[pi-ai complete(model, context, apiKey)]
  I --> P[Print assistant reply]
  P --> U
```
