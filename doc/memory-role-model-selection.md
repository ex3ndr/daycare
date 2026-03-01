# Memory Role Model Selection

## Summary

When a role override sets an explicit model (for example, `models.memory`), Daycare now preserves that model ID during
Pi-AI provider client creation.

Previously, unknown explicit model IDs were silently replaced with provider defaults. This made memory-agent role
assignments appear ignored. The runtime now keeps explicit IDs and fails fast if the provider cannot resolve them.

## Flow

```mermaid
flowchart TD
    A[Agent descriptor: memory-agent] --> B[Resolve role key: memory]
    B --> C[Read settings.models.memory]
    C --> D[Apply provider/model override]
    D --> E[InferenceRouter.createClient(model)]
    E --> F{Explicit model provided?}
    F -->|Yes| G[Use explicit model ID as-is]
    F -->|No| H[Use provider default selection]
    G --> I{Provider can resolve model?}
    I -->|Yes| J[Run inference with explicit model]
    I -->|No| K[Throw unknown model error]
    H --> L[Run inference with default model]
```
