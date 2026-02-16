# Expose module

## Overview
The expose module adds runtime-managed tunnel endpoints so agents can publish local HTTP services.

Core pieces:
- `Exposes` facade: endpoint lifecycle, provider registry, persistence
- `ExposeProxy`: single local reverse proxy with host routing + optional Basic auth
- Provider plugins: `tailscale`, `cloudflare-tunnel`, `custom-tunnel`
- Core tools: `expose_create`, `expose_update`, `expose_remove`, `expose_list`

Endpoint state persists under:
- `configDir/expose/endpoints/<endpointId>.json`

## Runtime flow
```mermaid
flowchart LR
  Agent[Agent tool call] --> Tools[expose_* tools]
  Tools --> Exposes[Exposes facade]
  Exposes --> Proxy[ExposeProxy on 127.0.0.1:random]
  Exposes --> Provider[Plugin tunnel provider]
  Provider --> Internet[Public/LAN URL]
  Internet --> Provider
  Provider --> Proxy
  Proxy --> Local[Local port or unix socket]
```

## Startup and shutdown
```mermaid
sequenceDiagram
  participant Engine
  participant Plugins
  participant Exposes
  participant Proxy

  Engine->>Plugins: reload()
  Plugins->>Exposes: registerProvider(...)
  Engine->>Exposes: ensureDir()
  Engine->>Exposes: start()
  Exposes->>Proxy: start(127.0.0.1:0)
  Exposes->>Exposes: load endpoint files
  Exposes->>Plugins: createTunnel(proxyPort, mode)
  Exposes->>Proxy: addRoute(domain, target, passwordHash?)

  Engine->>Exposes: stop()
  Exposes->>Plugins: destroyTunnel(domain)
  Exposes->>Proxy: stop()
```

## Authentication model
- Endpoint auth is optional.
- When enabled, username is fixed to `daycare`.
- Password is randomly generated and returned once to the caller.
- Only bcrypt hash is persisted in endpoint JSON.
- `expose_update` regenerates a password whenever auth is enabled.

## Tailscale binary resolution
The Tailscale plugin resolves the executable path at runtime:
- macOS App Store install: `/Applications/Tailscale.app/Contents/MacOS/Tailscale`
- fallback: `tailscale` from shell `PATH`
- Endpoint domain uses machine DNS (`Self.DNSName`) directly.
- Tailscale backend supports one active expose endpoint per node profile.

```mermaid
flowchart TD
  Start[Plugin load] --> Platform{process.platform == darwin}
  Platform -- no --> PathCmd[Use tailscale]
  Platform -- yes --> Exists{App bundle binary exists}
  Exists -- yes --> AppCmd[Use /Applications/Tailscale.app/Contents/MacOS/Tailscale]
  Exists -- no --> PathCmd
```
