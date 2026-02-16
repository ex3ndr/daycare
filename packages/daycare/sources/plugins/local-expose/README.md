# Local Expose Plugin

Registers an expose provider for plain HTTP on local port `80` (no TLS termination).

## Settings
- `domain`: hostname routed by the expose proxy (for example `app.local.test`)

## Behavior
- Starts a managed userspace forwarder process bound to `0.0.0.0:80`
- Forwards traffic to the internal expose proxy port on `127.0.0.1`
- Keeps one active endpoint/domain per plugin instance
- Provider capabilities: `{ public: true, localNetwork: true }`
- Forwarder process is plugin-owned and removed on endpoint removal/unload/delete

## Notes
- This plugin serves **HTTP only**. TLS/HTTPS is intentionally not configured.
- Binding port `80` may require elevated privileges or OS-specific capability configuration.
