export type {
  TranscriptionOptions,
  TranscriptionResult,
  TranscriptionExecutor,
  TranscriptionProvider,
} from "./types.js";

export { TranscriptionRegistry } from "./registry.js";

// Provider factory exports
export {
  createOpenAITranscriptionProvider,
  createDeepgramTranscriptionProvider,
  createElevenLabsTranscriptionProvider,
} from "./providers/index.js";

export type {
  OpenAITranscriptionConfig,
  DeepgramTranscriptionConfig,
  ElevenLabsTranscriptionConfig,
} from "./providers/index.js";