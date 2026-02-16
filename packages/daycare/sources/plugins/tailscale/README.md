# Tailscale plugin

## Overview
Registers a tunnel provider for the expose module using the local `tailscale` CLI.

## Behavior
- Resolves machine DNS using `tailscale status --json` (`Self.DNSName`)
- Resolves binary path:
  - macOS App Store install: `/Applications/Tailscale.app/Contents/MacOS/Tailscale`
  - otherwise: `tailscale` from shell `PATH`
- Registers expose provider capabilities:
  - `public: true` (via `tailscale funnel`)
  - `localNetwork: true` (via `tailscale serve`)
- Creates/removes tunnels with CLI commands
- Returns the node DNS name directly for endpoint domain (no fabricated subdomains)
- Supports one active Tailscale expose endpoint per node profile

## Notes
- Domain base is derived from machine DNS by removing the hostname label.
- Endpoint domains are generated under the resolved base domain.
