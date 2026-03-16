# System Prompt Local Date Timezone

## What changed

- The system prompt preamble now formats `Current date` in a resolved local timezone instead of using the UTC calendar date.
- The rendered date line now includes the timezone string so the model can see which calendar is being used.
- Timezone resolution prefers the user's valid profile timezone, then the runtime timezone, then `UTC`.

```mermaid
flowchart TD
    A[Build system preamble] --> B{Profile timezone valid?}
    B -- yes --> C[Use profile timezone]
    B -- no --> D{Runtime timezone valid?}
    D -- yes --> E[Use runtime timezone]
    D -- no --> F[Use UTC]
    C --> G[Format yyyy-mm-dd in resolved timezone]
    E --> G
    F --> G
    G --> H[Render Current date with timezone label]
```
