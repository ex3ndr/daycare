# Auth tokens

Scout stores connector and inference tokens in `.scout/auth.json`.
The path is fixed and cannot be overridden by CLI flags.
Agent configuration (provider/model selection) lives in `.scout/settings.json`.

## Structure
```json
{
  "telegram": { "token": "..." },
  "codex": { "token": "..." },
  "claude-code": { "token": "..." }
}
```

## CLI helpers
- `scout add telegram` writes `auth.telegram.token`
- `scout add codex` writes `auth.codex.token`
- `scout add claude` writes `auth.claude-code.token`
Agent configuration is written to `.scout/settings.json`.

```mermaid
flowchart TD
  CLI[add command] --> Prompt[token prompt]
  Prompt --> Auth[.scout/auth.json]
```

## Usage
- `start` reads `.scout/auth.json` to load telegram tokens.
- `inference` helpers read `.scout/auth.json` when a token is not passed explicitly.
