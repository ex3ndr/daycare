# Image Output And Sandbox Home Policy

## Summary

Two runtime issues were addressed:

1. `generate_image` now returns concrete generated file paths (not only the downloads directory).
2. Sandbox runtime read deny policy keeps denying the host OS home root, including when a remapped user home is nested under it.

## Flow

```mermaid
flowchart TD
    A[generate_image provider files] --> B[save each file to ~/downloads]
    B --> C[tool result includes generated path list]
    C --> D[agent can call send_file with exact filename]

    E[sandbox exec] --> F[build filesystem denyRead policy]
    F --> G[deny osHomeDir and daycare config root]
    G --> J[apply denyRead policy]
```

## Notes

- The runtime still denies sensitive paths and Daycare config paths.
- The host OS-home deny remains unconditional.
