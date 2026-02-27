# Speech Generation Module

## Overview
Add a speech generation subsystem mirroring the image generation pattern, plus an ElevenLabs plugin. When complete:

- A `SpeechGenerationRegistry` facade manages registered TTS providers (register/unregister/get/list).
- A `SpeechGenerationProvider` interface defines the contract: `id`, `label`, `generate(request, context)`, and optional `listVoices(context)` for providers that support voice discovery.
- A `generate_speech` tool is exposed to agents with parameters: `text` (required), `provider`, `model`, `voice`, `speed`, `language`, `output_format` (optional).
- A `list_voices` tool is exposed to agents to query available voices from speech providers.
- `PluginRegistrar` gains `registerSpeechProvider` / `unregisterSpeechProvider` with tracked cleanup.
- `ModuleRegistry` creates and holds the speech registry.
- `@/types` re-exports `SpeechGenerationProvider`.
- An **ElevenLabs plugin** (`elevenlabs`) registers a speech provider using the ElevenLabs API, supporting voice listing, text-to-speech generation, and configurable model/voice/format. Named broadly since ElevenLabs offers more than TTS — only speech is implemented for now.
- No built-in provider wiring (`ProviderDefinition` capabilities, `PiAiProviderConfig` callbacks) — speech is plugin-only for now.

## Context
Files/components involved (mirroring image generation):
- `engine/modules/images/types.ts` → new `engine/modules/speech/types.ts`
- `engine/modules/imageGenerationRegistry.ts` → new `engine/modules/speechGenerationRegistry.ts`
- `engine/modules/tools/image-generation.ts` → new `engine/modules/tools/speech-generation.ts`
- new `engine/modules/tools/voice-list.ts` — list_voices tool
- `engine/modules/moduleRegistry.ts` — add `speech` field
- `engine/plugins/registry.ts` — add speech registration methods + tracking set
- `engine/engine.ts` — register speech and voice tools at startup
- `types.ts` — re-export `SpeechGenerationProvider`
- new `plugins/elevenlabs/` — ElevenLabs plugin (plugin.json, plugin.ts, README.md)

## Development Approach
- **Testing approach**: Regular (code first, then tests)
- Complete each task fully before moving to the next
- Make small, focused changes
- **CRITICAL: every task MUST include new/updated tests** for code changes in that task
- **CRITICAL: all tests must pass before starting next task**
- **CRITICAL: update this plan file when scope changes during implementation**
- Run tests after each change
- Maintain backward compatibility

## Testing Strategy
- **Unit tests**: required for every task
- Speech generation tool test mirrors `image-generation.spec.ts` pattern (mock provider, verify file written to sandbox)
- Registry tests verify register/unregister/list/get behavior
- Voice list tool test uses mock provider with `listVoices` returning test data
- ElevenLabs plugin: no integration tests (requires API key); verify plugin structure compiles

## Progress Tracking
- Mark completed items with `[x]` immediately when done
- Add newly discovered tasks with ➕ prefix
- Document issues/blockers with ⚠️ prefix
- ⚠️ `yarn lint` currently reports existing unrelated workspace diagnostics; speech-module files pass targeted Biome checks.

## Implementation Steps

### Task 1: Define speech generation types
- [x] Create `packages/daycare/sources/engine/modules/speech/types.ts` with:
  - `SpeechGenerationRequest`: `text: string`, `voice?: string`, `speed?: number`, `language?: string`, `outputFormat?: string`, `model?: string`
  - `SpeechGenerationResult`: `files: FileReference[]`
  - `SpeechGenerationContext`: `fileStore: FileFolder`, `auth: AuthStore`, `logger: Logger`
  - `SpeechVoice`: `id: string`, `name: string`, `language?: string`, `preview?: string`
  - `SpeechGenerationProvider`: `id: string`, `label: string`, `generate(request, context)`, `listVoices?: (context) => Promise<SpeechVoice[]>`
- [x] Re-export `SpeechGenerationProvider` from `sources/types.ts` under `// Speech` section
- [x] Run linter and typecheck

### Task 2: Create SpeechGenerationRegistry facade
- [x] Create `packages/daycare/sources/engine/modules/speechGenerationRegistry.ts` mirroring `imageGenerationRegistry.ts`
  - Logger: `getLogger("speech.registry")`
  - Methods: `register(pluginId, provider)`, `unregister(id)`, `unregisterByPlugin(pluginId)`, `get(id)`, `list()`
- [x] Write tests in `speechGenerationRegistry.spec.ts` (register, unregister, unregisterByPlugin, get, list)
- [x] Run tests — must pass before next task

### Task 3: Wire registry into ModuleRegistry
- [x] Add `readonly speech: SpeechGenerationRegistry` to `ModuleRegistry`
- [x] Instantiate in constructor: `this.speech = new SpeechGenerationRegistry()`
- [x] Run typecheck and tests

### Task 4: Add speech registration to PluginRegistrar
- [x] Add `speech: Set<string>` to `PluginRegistrations` type
- [x] Initialize `speech: new Set()` in constructor
- [x] Add `registerSpeechProvider(provider: SpeechGenerationProvider)` method
- [x] Add `unregisterSpeechProvider(id: string)` method
- [x] Add speech cleanup in `unregisterAll()` method
- [x] Add `speechRegistry: SpeechGenerationRegistry` parameter to `PluginRegistrar` constructor
- [x] Update `PluginRegistry` constructor and `createRegistrar` to pass speech registry
- [x] Run typecheck and tests — must pass before next task

### Task 5: Build generate_speech tool
- [x] Create `packages/daycare/sources/engine/modules/tools/speech-generation.ts`
  - Function: `buildSpeechGenerationTool(speechRegistry: SpeechGenerationRegistry): ToolDefinition`
  - Tool name: `generate_speech`
  - TypeBox schema: `text` (required), `provider`, `model`, `voice`, `speed`, `language`, `output_format` (all optional)
  - Result contract: `summary`, `provider`, `fileCount`, `generated[]` (name, path, mimeType, size)
  - Audio extension resolver: mp3, wav, ogg, flac, aac, opus, webm, m4a → extensions
  - Execution: resolve provider, call generate, write audio files to `~/downloads/` with timestamp filenames
- [x] Write tests in `speech-generation.spec.ts` mirroring `image-generation.spec.ts` (mock provider returns audio bytes, verify file written to sandbox)
- [x] Write tests for error cases (no providers, unknown provider, multiple providers without explicit selection)
- [x] Run tests — must pass before next task

### Task 6: Build list_voices tool
- [x] Create `packages/daycare/sources/engine/modules/tools/voice-list.ts`
  - Function: `buildVoiceListTool(speechRegistry: SpeechGenerationRegistry): ToolDefinition`
  - Tool name: `list_voices`
  - TypeBox schema: `provider` (optional)
  - Execution: resolve provider(s), call `listVoices` on each that supports it, aggregate results
  - Result contract: `voices[]` (id, name, language, provider) + `summary` text
  - If provider has no `listVoices`, return empty list for that provider with a note
- [x] Write tests in `voice-list.spec.ts` (provider with voices, provider without listVoices, multiple providers)
- [x] Run tests — must pass before next task

### Task 7: Register tools in engine startup
- [x] Import `buildSpeechGenerationTool` and `buildVoiceListTool` in `engine.ts`
- [x] Add `this.modules.tools.register("core", buildSpeechGenerationTool(this.modules.speech))` next to image generation tool
- [x] Add `this.modules.tools.register("core", buildVoiceListTool(this.modules.speech))` next to speech tool
- [x] Run typecheck and full test suite

### Task 8: Create ElevenLabs TTS plugin
- [x] Create `packages/daycare/sources/plugins/elevenlabs/plugin.json`:
  - id: `elevenlabs`, name: `ElevenLabs`, description: `ElevenLabs speech provider.`, entry: `./plugin.js`
- [x] Create `packages/daycare/sources/plugins/elevenlabs/plugin.ts`:
  - Settings schema (zod): `model?: string`, `voice?: string`, `outputFormat?: string`, `providerId?: string`, `label?: string`, `authId?: string`
  - Onboarding: prompt for ElevenLabs API token, store under `authId ?? "elevenlabs"`
  - `load()`: register speech provider via `api.registrar.registerSpeechProvider()`
  - `unload()`: unregister via `api.registrar.unregisterSpeechProvider()`
  - `generate()`: call ElevenLabs `POST /v1/text-to-speech/{voice_id}` endpoint, save audio via `fileStore.saveBuffer()`, return `FileReference[]`
  - `listVoices()`: call ElevenLabs `GET /v1/voices` endpoint, map to `SpeechVoice[]`
  - Default model: `eleven_multilingual_v2`, default voice: `Rachel`, default format: `mp3_44100_128`
- [x] Create `packages/daycare/sources/plugins/elevenlabs/README.md` documenting settings, auth, and behavior
- [x] Run typecheck and linter

### Task 9: Verify acceptance criteria
- [x] Verify all types, registry, tools, plugin registrar, engine wiring, and ElevenLabs plugin are complete
- [x] Run full test suite (`yarn test`)
- [x] Run linter (`yarn lint`)
- [x] Run typecheck (`yarn typecheck`)

### Task 10: [Final] Update documentation
- [x] Update `doc/PLUGINS.md` to mention `registerSpeechProvider` / `unregisterSpeechProvider` in the registrar API section
- [x] Add `doc/internals/speech-generation.md` with a mermaid diagram showing the data flow (text → tool → registry → provider → audio file → sandbox)

## Technical Details

### Types
```typescript
// engine/modules/speech/types.ts
export type SpeechGenerationRequest = {
    text: string;
    voice?: string;
    speed?: number;
    language?: string;
    outputFormat?: string;
    model?: string;
};

export type SpeechGenerationResult = {
    files: FileReference[];
};

export type SpeechGenerationContext = {
    fileStore: FileFolder;
    auth: AuthStore;
    logger: Logger;
};

export type SpeechVoice = {
    id: string;
    name: string;
    language?: string;
    preview?: string;
};

export type SpeechGenerationProvider = {
    id: string;
    label: string;
    generate: (request: SpeechGenerationRequest, context: SpeechGenerationContext) => Promise<SpeechGenerationResult>;
    listVoices?: (context: SpeechGenerationContext) => Promise<SpeechVoice[]>;
};
```

### Audio extension mapping
```typescript
const audioExtensionByMimeType: Record<string, string> = {
    "audio/mpeg": ".mp3",
    "audio/mp3": ".mp3",
    "audio/wav": ".wav",
    "audio/x-wav": ".wav",
    "audio/wave": ".wav",
    "audio/ogg": ".ogg",
    "audio/flac": ".flac",
    "audio/aac": ".aac",
    "audio/opus": ".opus",
    "audio/webm": ".webm",
    "audio/mp4": ".m4a",
    "audio/x-m4a": ".m4a",
};
```

### generate_speech tool schema
```typescript
const schema = Type.Object({
    text: Type.String({ minLength: 1 }),
    provider: Type.Optional(Type.String({ minLength: 1 })),
    model: Type.Optional(Type.String({ minLength: 1 })),
    voice: Type.Optional(Type.String({ minLength: 1 })),
    speed: Type.Optional(Type.Number({ minimum: 0.25, maximum: 4.0 })),
    language: Type.Optional(Type.String({ minLength: 1 })),
    output_format: Type.Optional(Type.String({ minLength: 1 })),
}, { additionalProperties: false });
```

### list_voices tool schema
```typescript
const schema = Type.Object({
    provider: Type.Optional(Type.String({ minLength: 1 })),
}, { additionalProperties: false });
```

### ElevenLabs API endpoints
- **TTS**: `POST https://api.elevenlabs.io/v1/text-to-speech/{voice_id}` — returns raw audio bytes
  - Headers: `xi-api-key`, `Content-Type: application/json`
  - Body: `{ text, model_id, voice_settings: { stability, similarity_boost } }`
  - Query: `?output_format=mp3_44100_128`
- **Voices**: `GET https://api.elevenlabs.io/v1/voices` — returns `{ voices: [{ voice_id, name, labels }] }`
  - Headers: `xi-api-key`

### Data flow
```
Agent calls generate_speech tool
  → Tool resolves provider from SpeechGenerationRegistry
  → Provider.generate(request, context) called
    → Provider fetches API key from auth store
    → Provider calls external TTS API (e.g., ElevenLabs)
    → Provider saves audio bytes via fileStore.saveBuffer()
    → Returns FileReference[]
  → Tool writes audio files to ~/downloads/ via sandbox.write()
  → Tool returns ToolExecutionResult with summary + file paths

Agent calls list_voices tool
  → Tool resolves provider(s) from SpeechGenerationRegistry
  → Provider.listVoices(context) called (if supported)
    → Provider fetches API key from auth store
    → Provider calls external voices API
    → Returns SpeechVoice[]
  → Tool aggregates and returns voice list
```

## Post-Completion

**Future extensions** (not in scope):
- Provider-level `speech` capability flag and `PiAiProviderConfig.speechProvider` callback for built-in providers
- OpenAI TTS plugin (similar pattern to ElevenLabs)
- Streaming audio support
- SSML input support
