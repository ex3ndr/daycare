# pi-ai GPT-5.4 Refresh

## Summary
- Upgraded `@mariozechner/pi-ai` from `0.55.3` to `0.57.1`.
- Manually refreshed the curated provider registry in `packages/daycare/sources/providers/models.ts` to match the new upstream catalog.
- Kept the registry scoped to Daycare's curated provider subset and validated each listed provider against upstream `pi-ai` ids.
- Promoted `gpt-5.4` and `gpt-5.4-pro` to the front of OpenAI-family provider lists.
- Removed the stray `opencode-go` provider block after confirming Daycare does not register that provider.
- Updated the custom Zen provider to default to `gpt-5.4` and documented the newer GPT listings in provider docs.

## Catalog Flow

```mermaid
flowchart TD
    A[Upgrade pi-ai package] --> B[Compare upstream provider ids]
    B --> C[Refresh curated Daycare registry]
    C --> D[Keep only providers Daycare actually exposes]
    C --> E[Sync model ids for each curated provider]
    D --> F[Promote gpt-5.4 in OpenAI-family lists]
    E --> F
    F --> G[Update Zen default model]
    G --> H[Refresh provider docs]
    H --> I[Validate curated subset against pi-ai tests, lint, typecheck, and build]
```
