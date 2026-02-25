# Portless Named Dev Environment

Named development environments are started with `yarn env <name>`.

Each environment uses `.data/<name>` for state and writes a merged prefixed log to `.data/<name>/env.log`.

## Runtime topology

```mermaid
flowchart LR
    Dev[yarn env test1] --> Proxy[portless proxy :1355]
    Proxy --> ApiRoute[api.test1.localhost]
    Proxy --> AppRoute[app.test1.localhost]
    ApiRoute --> ApiSvc[daycare-cli start with daycare-app-server plugin]
    AppRoute --> AppSvc[expo web for daycare-app]
    ApiSvc --> DataDir[.data/test1]
    AppSvc --> DataDir
```

## Logs

```mermaid
flowchart TD
    ApiStdout[api stdout/stderr] --> Merge[envRun prefixed line merger]
    AppStdout[app stdout/stderr] --> Merge
    Merge --> File[.data/<name>/env.log]
    Merge --> Console[terminal output]
```
