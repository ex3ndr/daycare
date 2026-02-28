# ElevenLabs Direct Tools

The ElevenLabs plugin now registers three direct tools in addition to speech provider integration:

- `elevenlabs_generate_music`
- `elevenlabs_generate_sound_effects`
- `elevenlabs_voice_isolator`

All tools resolve API keys from auth storage (`authId`, default `elevenlabs`) and save generated files into sandbox downloads.

```mermaid
sequenceDiagram
    participant Agent as Agent
    participant Tool as elevenlabs_* tool
    participant Auth as AuthStore
    participant API as ElevenLabs API
    participant SB as Sandbox

    Agent->>Tool: execute(args)
    Tool->>Auth: getApiKey(authId)
    Tool->>API: call music/sfx/isolation endpoint
    API-->>Tool: audio stream + content-type
    Tool->>SB: write ~/downloads/elevenlabs-*.{mp3|wav|...}
    Tool-->>Agent: toolResult + file metadata
```

## Output format behavior

- Music and sound effects accept shorthand aliases: `mp3` and `mpeg` map to `mp3_44100_128`.
- Voice isolator derives output extension from response `content-type`.
- Tool result payload includes `filePath`, `fileName`, `mimeType`, and `size`.
