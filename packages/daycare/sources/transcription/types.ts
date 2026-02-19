/**
 * Options for transcription requests.
 */
export type TranscriptionOptions = {
  /**
   * Language hint for transcription (e.g., "en", "es", "auto").
   * If not specified, the provider will attempt to detect the language.
   */
  language?: string;
  /**
   * Context hint to improve transcription accuracy.
   */
  prompt?: string;
};

/**
 * Result of a transcription request.
 */
export type TranscriptionResult = {
  /**
   * The transcribed text.
   */
  text: string;
  /**
   * Detected or specified language code.
   */
  language?: string;
  /**
   * Audio duration in seconds.
   */
  duration?: number;
  /**
   * Confidence score (0-1) if provided by the provider.
   */
  confidence?: number;
};

/**
 * Function signature for transcription execution.
 */
export type TranscriptionExecutor = (args: {
  /**
   * Audio data as a Buffer or file path.
   */
  audio: Buffer | string;
  /**
   * MIME type of the audio (e.g., "audio/ogg", "audio/mp3", "audio/wav").
   */
  mimeType: string;
  /**
   * Optional transcription options.
   */
  options?: TranscriptionOptions;
}) => Promise<TranscriptionResult>;

/**
 * A transcription provider that can convert audio to text.
 */
export type TranscriptionProvider = {
  /**
   * Unique identifier for the provider.
   */
  id: string;
  /**
   * Human-readable label for the provider.
   */
  label: string;
  /**
   * Supported MIME types (e.g., ["audio/ogg", "audio/mp3", "audio/wav"]).
   * If not specified, the provider accepts any audio format.
   */
  supportedFormats?: string[];
  /**
   * The transcription executor function.
   */
  transcribe: TranscriptionExecutor;
};