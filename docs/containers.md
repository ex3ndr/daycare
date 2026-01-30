# Container runtime

Grambot can manage container lifecycles through the Docker Engine API (no shell calls).
The assistant can also run one-off containers via the `docker_run` tool.

## Responsibilities
- Connect to Docker over the API (socket or TCP).
- Start/stop/restart containers or ensure they are running.

```mermaid
flowchart TD
  Start[gram start] --> Load[load runtime.containers]
  Load --> Connect[Docker API ping]
  Connect --> Apply[apply container actions]
```

## Runtime config (excerpt)
```json
{
  "runtime": {
    "containers": {
      "connection": {
        "socketPath": "/var/run/docker.sock"
      },
      "containers": [
        { "name": "redis", "action": "ensure-running" },
        { "name": "worker", "action": "restart" }
      ]
    }
  }
}
```

Notes:
- `action` defaults to `ensure-running`.
- You can use `id` or `name` for each container.
- `stopTimeoutMs` controls graceful stop/restart timeouts.

## Assistant tool
`docker_run` runs commands inside a container with the workspace mounted.
The tool enforces `assistant.workspaceDir` and allowed images.

```mermaid
flowchart LR
  Tool[docker_run] --> Docker[DockerRuntime]
  Tool --> Workspace[assistant.workspaceDir]
  Tool --> Mount[/workspace]
```
