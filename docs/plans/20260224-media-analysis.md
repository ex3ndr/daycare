# Media Analysis (multi-modal file → text)

## Overview
Add a multi-modal media analysis capability that mirrors the image generation architecture. A single `media_analyze` agent tool accepts a file path (image, video, audio, or PDF) and an optional prompt, detects the media type, routes to a registered provider, and returns the model's text analysis.

- **Problem**: agents cannot understand media content (images, videos, audio, PDFs) via a unified tool
- **Solution**: `MediaAnalysisRegistry` + `MediaAnalysisProvider` type + `gemini-media` plugin + `media_analyze` core tool
- **Pattern**: mirrors `ImageGenerationRegistry` / `ImageGenerationProvider` / `nano-banana-pro` / `generate_image`

### Key behaviors
- **Media type detection**: tool detects mime type from file extension, determines media category (`image`, `video`, `audio`, `pdf`)
- **Default prompts per type**: prompt is optional; each media type has a sensible default prompt
- **Provider routing**: registry stores which media types each provider supports; tool picks the best provider for the detected type
- **Plugin settings**: plugin declares supported media types at registration time

## Context
- Image generation registry: `sources/engine/modules/imageGenerationRegistry.ts`
- Image generation types: `sources/engine/modules/images/types.ts`
- Image generation tool: `sources/engine/modules/tools/image-generation.ts`
- PDF process tool (reference): `sources/engine/modules/tools/pdf-process.ts`
- Plugin registrar: `sources/engine/plugins/registry.ts`
- Module registry: `sources/engine/modules/moduleRegistry.ts`
- Central types: `sources/types.ts`
- Nano-banana-pro plugin (reference): `sources/plugins/nano-banana-pro/`
- Engine wiring: `sources/engine/engine.ts` (line ~408 registers image gen tool)
- Tool filtering: `sources/engine/modules/tools/toolListContextBuild.ts`

## Development Approach
- **Testing approach**: Regular (code first, then tests)
- Complete each task fully before moving to the next
- Make small, focused changes
- **CRITICAL: every task MUST include new/updated tests**
- **CRITICAL: all tests must pass before starting next task**
- **CRITICAL: update this plan file when scope changes during implementation**

## Testing Strategy
- **Unit tests**: required for every task
- Registry: test register/unregister/get/list, filtering by media type
- Tool: test media type detection, default prompts, provider routing, error cases
- Plugin: integration test with mocked Gemini API

## Progress Tracking
- Mark completed items with `[x]` immediately when done
- Add newly discovered tasks with ➕ prefix
- Document issues/blockers with ⚠️ prefix

## Implementation Steps

### Task 1: Add MediaAnalysis types
- [x] Create `sources/engine/modules/media-analysis/types.ts` with types (see Technical Details below):
  - `MediaType` = `"image" | "video" | "audio" | "pdf"`
  - `MediaAnalysisRequest` = `{ filePath, mimeType, mediaType, prompt, model? }`
  - `MediaAnalysisResult` = `{ text }`
  - `MediaAnalysisContext` = `{ auth, logger }`
  - `MediaAnalysisProvider` = `{ id, label, supportedTypes, analyze }`
- [x] Export `MediaAnalysisProvider` and `MediaType` from `sources/types.ts`
- [x] Run tests — must pass before task 2

### Task 2: Add MediaAnalysisRegistry
- [x] Create `sources/engine/modules/mediaAnalysisRegistry.ts` mirroring `imageGenerationRegistry.ts`:
  - `register(pluginId, provider)` / `unregister(id)` / `unregisterByPlugin(pluginId)`
  - `get(id)` / `list()`
  - `findByMediaType(mediaType: MediaType)` — returns providers that support the given type
- [x] Add `readonly mediaAnalysis: MediaAnalysisRegistry` to `ModuleRegistry` in `moduleRegistry.ts`
- [x] Write `mediaAnalysisRegistry.spec.ts`: register, get, list, unregister, unregisterByPlugin, findByMediaType
- [x] Run tests — must pass before task 3

### Task 3: Wire registry into PluginRegistrar
- [x] Add `mediaAnalysisRegistry: MediaAnalysisRegistry` field + constructor param to `PluginRegistrar`
- [x] Add `mediaAnalysis` tracking set to `PluginRegistrations`
- [x] Add `registerMediaAnalysisProvider(provider)` and `unregisterMediaAnalysisProvider(id)` methods
- [x] Add cleanup in `unregisterAll()`
- [x] Update `PluginRegistry` constructor to accept `modules.mediaAnalysis` and pass to `createRegistrar()`
- [x] Run tests — must pass before task 4

### Task 4: Add media type detection utility
- [x] Create `sources/engine/modules/media-analysis/mediaTypeDetect.ts`:
  - `mediaTypeDetect(filePath: string): { mediaType: MediaType, mimeType: string } | null`
  - Maps file extensions to media types: `.png/.jpg/.jpeg/.gif/.webp/.bmp/.svg/.tiff/.avif/.heic` → image, `.mp4/.mov/.avi/.mkv/.webm/.flv` → video, `.mp3/.wav/.ogg/.flac/.m4a/.aac/.wma` → audio, `.pdf` → pdf
  - Returns `null` for unsupported extensions
- [x] Create `sources/engine/modules/media-analysis/mediaPromptDefault.ts`:
  - `mediaPromptDefault(mediaType: MediaType): string`
  - Image: `"Describe this image in detail, including key visual elements, text, and notable features."`
  - Video: `"Describe this video in detail, including key scenes, actions, and notable elements."`
  - Audio: `"Transcribe and describe this audio, including speech content, sounds, and notable elements."`
  - PDF: `"Analyze this PDF document. Summarize its content, structure, and key information."`
- [x] Write `mediaTypeDetect.spec.ts`: test all extension mappings, unknown extension returns null
- [x] Write `mediaPromptDefault.spec.ts`: test each media type returns non-empty string
- [x] Run tests — must pass before task 5

### Task 5: Add `media_analyze` core tool
- [x] Create `sources/engine/modules/tools/media-analysis.ts` exporting `buildMediaAnalysisTool(mediaAnalysisRegistry)`
- [x] Tool schema: `path` (string, required), `prompt` (string, optional), `provider` (string, optional), `model` (string, optional)
- [x] Tool logic:
  1. Read file from sandbox via `context.sandbox.read({ path, binary: true })`
  2. Detect media type from file extension using `mediaTypeDetect()`
  3. Use provided prompt or fall back to `mediaPromptDefault(mediaType)`
  4. Find provider: use explicit `provider` arg, or single available provider, or first provider supporting the detected media type via `findByMediaType()`
  5. Call `provider.analyze()` with request and context
  6. Return text result in `toolMessage.content` and typed result `{ text, provider, mediaType }`
- [x] Register tool in `engine.ts` alongside image generation tool
- [x] Add tool filtering in `toolListContextBuild.ts`: hide `media_analyze` when `mediaAnalysisRegistry.list().length === 0`
- [x] Write `media-analysis.spec.ts`: success case with mock provider, default prompt used when prompt omitted, no provider error, unknown provider error, unsupported media type error
- [x] Run tests — must pass before task 6

### Task 6: Create `gemini-media` plugin
- [x] Create `sources/plugins/gemini-media/plugin.json` with id `gemini-media`
- [x] Create `sources/plugins/gemini-media/plugin.ts`:
  - Settings schema: `model` (optional, default `gemini-3-flash-preview`), `baseUrl` (optional), `providerId` (optional), `label` (optional), `authId` (optional), `supportedTypes` (optional array of MediaType, default all four)
  - Onboarding: check for existing `google` API key, prompt if missing
  - `load()`: register media analysis provider via `api.registrar.registerMediaAnalysisProvider()`
  - Provider implementation:
    - Reads file from `request.filePath`, converts to base64
    - Calls Gemini `generateContent` with `inlineData` part (mimeType + data) + text prompt part
    - For PDF: sends as `application/pdf` inline data
    - Extracts text from response `candidates[0].content.parts[].text`
  - `unload()`: unregister provider
- [x] ➕ Add plugin-side reliability guards:
  - Reject files larger than `maxFileSizeBytes` (default 20 MB) before inline upload
  - Add `requestTimeoutMs` (default 60s) with `AbortController` for Gemini requests
- [x] Create `sources/plugins/gemini-media/README.md` documenting the plugin
- [x] Write `sources/plugins/gemini-media/__tests__/plugin.integration.spec.ts` testing provider with mocked fetch for image and audio cases, plus oversized-file rejection
- [x] Run tests — must pass before task 7

### Task 7: Verify acceptance criteria
- [x] Verify registry supports `findByMediaType()` routing
- [x] Verify tool accepts file path + optional prompt, returns text
- [x] Verify default prompts are used when prompt is omitted
- [x] Verify plugin declares supported media types from settings
- [x] Verify tool is hidden when no providers registered
- [x] Run full test suite (`yarn test`)
- [x] Run linter (`yarn lint`)
- [x] Run typecheck (`yarn typecheck`)

### Task 8: [Final] Update documentation
- [x] Update `doc/PLUGINS.md` if new registration method needs documenting
- [x] Add entry in any plugin catalog/list if one exists

## Technical Details

### MediaType
```typescript
type MediaType = "image" | "video" | "audio" | "pdf";
```

### MediaAnalysisRequest
```typescript
type MediaAnalysisRequest = {
    filePath: string;       // absolute path to file on disk
    mimeType: string;       // detected mime type (e.g. "image/png", "video/mp4")
    mediaType: MediaType;   // detected category
    prompt: string;         // analysis prompt (already resolved — default or user-provided)
    model?: string;         // optional model override
};
```

### MediaAnalysisResult
```typescript
type MediaAnalysisResult = {
    text: string;           // the analysis text returned by the model
};
```

### MediaAnalysisContext
```typescript
type MediaAnalysisContext = {
    auth: AuthStore;
    logger: Logger;
};
```

### MediaAnalysisProvider
```typescript
type MediaAnalysisProvider = {
    id: string;
    label: string;
    supportedTypes: MediaType[];    // which media types this provider can handle
    analyze: (request: MediaAnalysisRequest, context: MediaAnalysisContext) => Promise<MediaAnalysisResult>;
};
```

### Tool result contract
```typescript
type MediaAnalysisToolResult = {
    text: string;
    provider: string;
    mediaType: MediaType;
};
```

### Gemini API call shape (all media types use the same endpoint)
```typescript
// POST https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent
{
    contents: [{
        parts: [
            { text: prompt },
            { inlineData: { mimeType: "image/png", data: base64Data } }
            // works for image/*, video/*, audio/*, application/pdf
        ]
    }]
}
```

### Response extraction
```typescript
// Concatenate all text parts from the first candidate
// response.candidates[0].content.parts.filter(p => p.text).map(p => p.text).join("")
```

### Default prompts
| Media type | Default prompt |
|-----------|---------------|
| `image` | "Describe this image in detail, including key visual elements, text, and notable features." |
| `video` | "Describe this video in detail, including key scenes, actions, and notable elements." |
| `audio` | "Transcribe and describe this audio, including speech content, sounds, and notable elements." |
| `pdf` | "Analyze this PDF document. Summarize its content, structure, and key information." |

### Extension → media type mapping
| Media type | Extensions |
|-----------|-----------|
| `image` | `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, `.bmp`, `.svg`, `.tiff`, `.avif`, `.heic` |
| `video` | `.mp4`, `.mov`, `.avi`, `.mkv`, `.webm`, `.flv` |
| `audio` | `.mp3`, `.wav`, `.ogg`, `.flac`, `.m4a`, `.aac`, `.wma` |
| `pdf` | `.pdf` |

## Post-Completion

**Manual verification:**
- Test with real Gemini API key against each media type
- Test image analysis (PNG, JPEG, WebP)
- Test video analysis (MP4)
- Test audio transcription (MP3, WAV)
- Test PDF analysis
- Test with and without custom prompts
- Test provider routing when multiple providers are registered with different type support

**Configuration:**
- Add `gemini-media` plugin instance to `.daycare/settings.json` with `google` auth
