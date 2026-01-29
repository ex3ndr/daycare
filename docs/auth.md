# Auth tokens

Scout stores connector and inference tokens in a local `auth.json` file.

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

```mermaid
flowchart TD
  CLI[add command] --> Prompt[token prompt]
  Prompt --> Auth[auth.json]
```

## Usage
- `start` reads `auth.json` to load telegram tokens.
- `inference` helpers read `auth.json` when a token is not passed explicitly.
