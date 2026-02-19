/**
 * Core transcription types and interfaces.
 * Provider-agnostic definitions for audio transcription.
 */

export type TranscriptionOptions = {
  /** Language code (ISO 639-1), e.g., "en", "es". Use "auto" for auto-detection. */
  language?: string;
  /** Optional context hint to improve transcription accuracy. */
  prompt?: string;
  /** Response format preference. */
  format?: "text" | "json" | "verbose";
};

export type TranscriptionResult = {
  /** The transcribed text. */
  text: string;
  /** Detected or specified language code. */
  language?: string;
  /** Audio duration in seconds. */
  duration?: number;
  /** Confidence score (0-1) if available. */
  confidence?: number;
  /** Raw provider response for debugging. */
  raw?: unknown;
};

export type TranscriptionProvider = {
  /** Unique provider identifier, e.g., "openai", "deepgram". */
  id: string;
  /** Human-readable provider name. */
  name: string;
  /** Transcribe audio to text. */
  transcribe: (
    audio: Buffer | string,
    mimeType: string,
    options?: TranscriptionOptions
  ) => Promise<TranscriptionResult>;
};

export type TranscriptionProviderFactory = (config: unknown) => TranscriptionProvider;

export type TranscriptionError = Error & {
  code?: string;
  provider?: string;
};