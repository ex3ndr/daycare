# Local Expose Plugin

Registers an expose provider for plain HTTP on a configurable local port (default `18221`, no TLS termination).

## Settings
- `domain`: hostname routed by the expose proxy (for example `app.local.test`)
- `port`: local HTTP listen port (default `18221`)

## Behavior
- Starts a managed userspace forwarder process bound to `0.0.0.0:<port>` (default `18221`)
- Starts the forwarder via inline Node script (`node -e ...`) so runtime does not depend on source file paths
- Requests sandbox `allowLocalBinding: true` so local listen sockets are permitted
- Forwards traffic to the internal expose proxy port on `127.0.0.1`
- Keeps one active endpoint/domain per plugin instance
- Provider capabilities: `{ public: true, localNetwork: true }`
- Forwarder process is plugin-owned and removed on endpoint removal/unload/delete

## Notes
- This plugin serves **HTTP only**. TLS/HTTPS is intentionally not configured.
- Choose an available local port. Avoid privileged ports if your OS requires elevated permissions.
