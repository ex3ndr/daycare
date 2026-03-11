# Docker Container Ensure Build Fix

## Summary

The Docker container ensure spec now reads the mocked `createContainer()` arguments through `Array.prototype.at()` and optional chaining instead of unchecked tuple indexing.

- preserves the existing `HostConfig.Init === true` assertion
- satisfies strict TypeScript checks during the CLI build
- keeps the change isolated to the spec that was failing `yarn build`

## Flow

```mermaid
sequenceDiagram
    participant Test as dockerContainerEnsure.spec.ts
    participant Mock as createContainer mock
    participant Calls as mock.calls
    participant Assert as Init assertion

    Test->>Mock: dockerContainerEnsure(...)
    Mock-->>Calls: record call arguments
    Test->>Calls: calls.at(0)?.at(0)
    Calls-->>Assert: first createContainer config
    Assert->>Assert: verify HostConfig.Init === true
```
