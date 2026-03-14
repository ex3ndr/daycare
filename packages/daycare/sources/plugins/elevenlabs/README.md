# ElevenLabs Plugin

The `elevenlabs` plugin provides:

- speech provider wiring for `generate_speech` and `list_voices`
- voice-agent provider wiring for ElevenLabs Conversational AI session bootstrap
- direct audio tools with `elevenlabs_` names:
  - `elevenlabs_generate_music`
  - `elevenlabs_generate_sound_effects`
  - `elevenlabs_voice_isolator`

## What it does

- Registers a `SpeechGenerationProvider` via `registerSpeechProvider()`
- Registers a `VoiceAgentProvider` via `registerVoiceAgentProvider()`
- Uses ElevenLabs text-to-speech for provider `generate()`
- Uses a hardcoded voice catalog (`id` + `description`) for `listVoices()`
- Uses a shared base agent id plus per-session prompt/tool overrides for voice calls
- Registers direct tools for music generation, sound effects, and voice isolation
- Writes direct-tool audio files to `~/downloads` in sandbox

## Settings

- `model` (optional): default TTS model (`eleven_multilingual_v2`)
- `voice` (optional): default voice id (`21m00Tcm4TlvDq8ikWAM`)
- `outputFormat` (optional): default TTS output format (`mp3_44100_128`)
  - TTS shorthand aliases: `mp3`/`mpeg` -> `mp3_44100_128`, `wav` -> `wav_44100`
- `providerId` (optional): registered speech provider id (defaults to plugin id)
- `label` (optional): provider label shown in registry
- `baseAgentId` (optional but required for voice calls): shared ElevenLabs Conversational AI agent id
- `authId` (optional): auth key id used to read API token (defaults to `elevenlabs`)
- `voices` (optional): hardcoded catalog entries for `list_voices`
  - item shape: `{ id: string, description: string }`
  - defaults to built-in catalog from `voiceCatalog.ts`

## Voice Agents

When `baseAgentId` is configured, the plugin can start reusable Daycare voice agents through the `VoiceAgentProvider`
registry.

- Daycare stores the voice agent prompt, client-tool definitions, and provider settings in `voice_agents`
- The plugin returns the shared ElevenLabs `baseAgentId`
- The app starts the conversation with per-session `overrides.agent.prompt.prompt`
- Voice-agent tool definitions are forwarded as client tools so the app can execute them locally

## Auth

On onboarding, the plugin prompts for an ElevenLabs API key and stores it in auth store under `authId` (`elevenlabs` by default).

## Runtime flow

```mermaid
flowchart TD
    A[Agent tool call] --> B{Tool type}
    B -->|generate_speech/list_voices| C[SpeechGenerationRegistry]
    C --> D[ElevenLabs speech provider]
    D --> E[ElevenLabs API]
    D --> F[fileStore.saveBuffer]
    B -->|voice-agents session/start| K[VoiceAgentRegistry]
    K --> L[ElevenLabs voice provider]
    L --> M[Return baseAgentId plus prompt/tool overrides]
    B -->|elevenlabs_generate_music| G[ElevenLabs music endpoint]
    B -->|elevenlabs_generate_sound_effects| H[ElevenLabs sound effects endpoint]
    B -->|elevenlabs_voice_isolator| I[ElevenLabs audio isolation endpoint]
    G --> J[Sandbox write ~/downloads]
    H --> J
    I --> J
```
