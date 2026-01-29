# PM2 runtime

Scout can launch long-running processes via programmatic PM2. This keeps processes alive independently of the CLI.

## Responsibilities
- Connect to PM2 daemon.
- Start configured processes with auto-restart enabled.
- Optionally disconnect on exit without stopping processes.

```mermaid
flowchart TD
  Start[scout start] --> Load[load runtime.pm2]
  Load --> Connect[pm2.connect]
  Connect --> StartProc[pm2.start]
  StartProc --> KeepAlive[pm2 keeps process alive]
  Stop[process exit] --> Disconnect[pm2.disconnect]
```

## Runtime config (excerpt)
```json
{
  "runtime": {
    "pm2": {
      "processes": [
        {
          "name": "worker",
          "script": "dist/worker.js",
          "args": ["--mode", "job"],
          "cwd": "/srv/scout",
          "env": { "NODE_ENV": "production" },
          "autorestart": true,
          "maxRestarts": 10,
          "minUptime": 5000
        }
      ]
    }
  }
}
```
