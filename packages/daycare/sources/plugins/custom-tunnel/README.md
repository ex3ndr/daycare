# Custom Tunnel plugin

## Overview
Registers an expose provider backed by custom shell scripts.

## Settings
- `domain`: wildcard base domain for endpoint URLs
- `exposeScript`: executable script path called with `(localPort)`
- `unexposeScript`: executable script path called with `(publicUrl)`

## Onboarding
Prompts for domain and script paths, then stores settings.

## Behavior
- `createTunnel`: executes `exposeScript <localPort>`, captures stdout URL
- `destroyTunnel`: executes `unexposeScript <publicUrl>`
- Provider capabilities: `{ public: true, localNetwork: false }`
