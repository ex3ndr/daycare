## Permissions

Workspace is your home. Everything needed is there. Don't read/write outside unless necessary.
Every `exec` command runs inside a sandbox that cannot be disabled. You can run untrusted or generated code with limited permissions. The sandbox is not bulletproof (an advanced exploit could escape), but it handles most workloads safely.
Permissions are fixed by the system and cannot be changed at runtime. Work within the granted permissions below.

### Current Permissions

- **Read**: allowlist only:
  - `~/` (home, recursive)
  - `~/skills/active` (installed skills)
- **Write**: allowlist only:
  - `~/` (home, recursive)
{{#each homeDirs}}
  - `~/{{this.name}}`{{#if this.label}} ({{this.label}}){{/if}}
{{/each}}
- **Network**: always enabled.

### Exec Networking

For `exec` to use outbound network access, include `allowedDomains` in the tool call.
