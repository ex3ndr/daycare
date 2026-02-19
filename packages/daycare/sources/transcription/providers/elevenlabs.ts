/**
 * ElevenLabs Scribe transcription provider.
 * Uses the ElevenLabs Speech-to-Text API for transcription.
 */

import type {
  TranscriptionProvider,
  TranscriptionResult,
  TranscriptionOptions,
} from "../types.js";

export type ElevenLabsTranscriptionConfig = {
  apiKey: string;
  /** Model to use: "scribe_v1" or "scribe_v2" (default). */
  model?: "scribe_v1" | "scribe_v2";
};

/**
 * Create an ElevenLabs Scribe transcription provider.
 */
export function createElevenLabsTranscriptionProvider(
  config: ElevenLabsTranscriptionConfig
): TranscriptionProvider {
  const model = config.model ?? "scribe_v2";
  const baseUrl = "https://api.elevenlabs.io/v1";

  return {
    id: "elevenlabs",
    name: "ElevenLabs Scribe",

    async transcribe(
      audio: Buffer | string,
      mimeType: string,
      options?: TranscriptionOptions
    ): Promise<TranscriptionResult> {
      // Prepare form data
      const formData = new FormData();

      // Handle audio input
      const audioBuffer =
        typeof audio === "string" ? Buffer.from(audio, "base64") : audio;
      const extension = mimeTypeToExtension(mimeType);
      const blob = new Blob([audioBuffer], { type: mimeType });
      formData.append("file", blob, `audio.${extension}`);

      // Model selection
      formData.append("model_id", model);

      // Map language code (ElevenLabs uses 3-letter codes like "eng", "spa")
      // but also accepts 2-letter codes
      if (options?.language && options.language !== "auto") {
        formData.append("language_code", options.language);
      }

      // Make request
      const response = await fetch(`${baseUrl}/speech-to-text`, {
        method: "POST",
        headers: {
          "xi-api-key": config.apiKey,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        const error = new Error(
          `ElevenLabs transcription failed: ${response.status} ${errorText}`
        ) as Error & { code?: string; provider?: string };
        error.code = `HTTP_${response.status}`;
        error.provider = "elevenlabs";
        throw error;
      }

      const data = await response.json();

      // Calculate duration from word timestamps if available
      let duration: number | undefined;
      if (data.words && data.words.length > 0) {
        const lastWord = data.words[data.words.length - 1];
        if (lastWord.end !== undefined) {
          duration = lastWord.end;
        }
      }

      // Build result
      const result: TranscriptionResult = {
        text: data.text,
        language: data.language_code ?? data.languageCode,
        duration,
        confidence: data.language_probability ?? data.languageProbability,
        raw: data,
      };

      return result;
    },
  };
}

/**
 * Map MIME type to file extension.
 * ElevenLabs supports: audio/x-m4a, audio/aiff, audio/mp4, audio/x-flac,
 * audio/flac, audio/webm, audio/x-wav, audio/wav, audio/opus, audio/mpeg,
 * video/mp4, video/webm, etc.
 */
function mimeTypeToExtension(mimeType: string): string {
  const map: Record<string, string> = {
    "audio/mpeg": "mp3",
    "audio/mp3": "mp3",
    "audio/mp4": "m4a",
    "audio/x-m4a": "m4a",
    "audio/m4a": "m4a",
    "audio/wav": "wav",
    "audio/x-wav": "wav",
    "audio/webm": "webm",
    "audio/ogg": "ogg",
    "audio/opus": "opus",
    "audio/flac": "flac",
    "audio/x-flac": "flac",
    "audio/aiff": "aiff",
    "video/mp4": "mp4",
    "video/webm": "webm",
  };
  return map[mimeType] ?? "mp3";
}