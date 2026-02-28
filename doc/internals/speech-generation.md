# Speech Generation

The speech generation module adds plugin-driven text-to-speech support through a registry and two core tools:

- `generate_speech`
- `list_voices`

## Runtime flow

```mermaid
flowchart LR
    A[Agent calls tool] --> B[ToolResolver]
    B --> C[generate_speech or list_voices]
    C --> D[SpeechGenerationRegistry]
    D --> E[SpeechGenerationProvider]
    E --> F[External TTS API]
    F --> G[Provider stores audio in FileFolder]
    G --> H[generate_speech writes to ~/downloads in sandbox]
    H --> I[Tool result with file metadata]
```

## Components

- `SpeechGenerationRegistry`: registers/unregisters providers and resolves them by id
- `SpeechGenerationProvider`: provider contract for generation and optional voice listing
- `PluginRegistrar`: exposes `registerSpeechProvider()` and `unregisterSpeechProvider()`
- `generate_speech` tool: resolves provider, calls generation, writes audio files to sandbox downloads
- `list_voices` tool: aggregates voice discovery from one or more providers

## Plugin-first model

Speech generation is plugin-only for now. Core provider definitions were not extended with built-in speech callbacks.

## ElevenLabs output format normalization

The ElevenLabs plugin normalizes shorthand output formats before calling the API:

- `mp3` and `mpeg` -> `mp3_44100_128`
- `wav` -> `wav_44100`
- explicit ElevenLabs enum values (for example `mp3_22050_32`) pass through unchanged
- unsupported values fail fast with a clear validation error

```mermaid
flowchart LR
    A[generate_speech output_format] --> B{shorthand?}
    B -->|mp3/mpeg| C[mp3_44100_128]
    B -->|wav| D[wav_44100]
    B -->|explicit enum| E[unchanged]
    B -->|invalid| F[throw unsupported output format]
    C --> G[ElevenLabs textToSpeech.convert]
    D --> G
    E --> G
```
