# Tool Return Contracts: Any Variant

## Summary

`ToolResolver` return schema validation allows an explicit `any` variant (`Type.Any()`) for top-level return properties, while keeping existing shallow constraints for all other schema shapes.

## Validation Rules

- Top-level return schema must be an object.
- Property schemas may be:
- primitive (`string`, `number`, `integer`, `boolean`, `null`)
- `any` (`Type.Any()` / `type: "any"`)
- union wrappers (`anyOf` / `oneOf` / `allOf`) when every variant is still valid under these same rules
- arrays of shallow objects (object items with primitive-only fields)
- `additionalProperties` cannot be unrestricted (`true`).

## Flow

```mermaid
flowchart TD
    A[Register tool] --> B{returns.schema is object?}
    B -- no --> X[Throw schema error]
    B -- yes --> C[Validate each property]
    C --> D{primitive?}
    D -- yes --> OK[Accept]
    D -- no --> E{any variant?}
    E -- yes --> OK
    E -- no --> U{union wrapper?}
    U -- yes --> V{all variants valid?}
    V -- yes --> OK
    V -- no --> X
    U -- no --> F{array of shallow objects?}
    F -- yes --> OK
    F -- no --> X
```
