# Sandbox Weaker Nested Flag

Daycare now supports `docker.enableWeakerNestedSandbox` in `settings.json` for Docker sandbox executions:

- Docker `Sandbox.exec()` includes `enableWeakerNestedSandbox: true` only when this setting is `true`
- Docker `Sandbox.exec()` omits the flag when this setting is `false`

Other runtime call sites keep their existing behavior:

- durable managed processes still enable the flag automatically when Daycare itself runs in Docker
- direct host `runInSandbox` calls still use Docker-environment marker detection

```mermaid
flowchart TD
  A[Sandbox.exec with docker.enabled=true] --> B{docker.enableWeakerNestedSandbox}
  B -->|true| C[set enableWeakerNestedSandbox=true]
  B -->|false| D[omit enableWeakerNestedSandbox]
  C --> E[@anthropic-ai/sandbox-runtime CLI]
  D --> E
```
