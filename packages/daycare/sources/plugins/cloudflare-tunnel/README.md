# Cloudflare Tunnel plugin

## Overview
Registers a public expose tunnel provider backed by the local `cloudflared` CLI.

## Onboarding
- Prompts for a Cloudflare tunnel token
- Stores token in auth store under plugin instance id

## Behavior
- Resolves a base hostname/domain from `cloudflared tunnel info --output json`
- Registers provider capabilities `{ public: true, localNetwork: false }`
- Creates/removes DNS routing entries for generated endpoint domains
