# Sandbox Weaker Nested Flag

Daycare now sets `enableWeakerNestedSandbox: true` on sandbox runtime configs used for:

- one-shot `exec` tool commands
- scheduled gate checks
- durable managed processes
- direct `runInSandbox` calls (defaulted when omitted)

This keeps behavior consistent across all runtime entry points.

```mermaid
flowchart TD
  A[Tool or scheduler command] --> B[Sandbox config builder]
  B --> C[enableWeakerNestedSandbox=true]
  C --> D[@anthropic-ai/sandbox-runtime CLI]
```
