# Remove Expose Module

The runtime no longer includes the expose subsystem. This change removes:

- the `Exposes` facade and its `expose_*` tools
- expose endpoint persistence and related topology/observation payloads
- expose-only tunnel plugins (`local-expose`, `cloudflare-tunnel`, `custom-tunnel`, `tailscale`)

```mermaid
flowchart TD
    Engine[Engine] --> Tools[Core tools]
    Engine --> Plugins[Plugin manager]
    Engine --> Storage[Storage]

    Tools --> Topology[topology]
    Tools -. removed .-> ExposeTools[expose_*]

    Plugins -. removed .-> TunnelPlugins[Expose tunnel plugins]

    Storage --> Agents[agents/tasks/channels/processes/...]
    Storage -. removed .-> ExposeTable[expose_endpoints]
```

Result:

- plugin API no longer includes expose-provider registration
- topology output no longer reports `exposes` or `exposeCount`
- topography observations no longer emit expose lifecycle events
