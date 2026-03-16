# ElevenLabs ESM Import Fix

## Problem

The ElevenLabs plugin imported `@elevenlabs/elevenlabs-js/api` at runtime to read enum-like format maps.

Under Node 22 ESM, that subpath is treated as a directory import. The package ships `api/index.js` but does not define an `exports` map for the subpath, so Node rejects it with `ERR_UNSUPPORTED_DIR_IMPORT`.

## Fix

The plugin now reads runtime enum values from the root package namespace export:

- `ElevenLabs.TextToSpeechConvertRequestOutputFormat`
- `ElevenLabs.AllowedOutputFormats`

Type-only imports still come from the `api` typings, so the plugin keeps the same compile-time contracts without relying on the unsupported runtime path.

```mermaid
flowchart LR
    A[daycare ElevenLabs plugin] --> B[@elevenlabs/elevenlabs-js]
    B --> C[ElevenLabs namespace export]
    C --> D[TextToSpeechConvertRequestOutputFormat]
    C --> E[AllowedOutputFormats]
    X[Old runtime path] --> Y[@elevenlabs/elevenlabs-js/api]
    Y --> Z[Node 22 ESM directory import error]
```
