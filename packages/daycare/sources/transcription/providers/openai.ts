/**
 * OpenAI Whisper transcription provider.
 * Uses the OpenAI Audio Transcriptions API.
 */

import type {
  TranscriptionProvider,
  TranscriptionResult,
  TranscriptionOptions
} from "../types.js";

export type OpenAITranscriptionConfig = {
  /** OpenAI API key. */
  apiKey: string;
  /** Model to use. Default: "whisper-1". */
  model?: string;
  /** Base URL for API. Default: "https://api.openai.com/v1". */
  baseUrl?: string;
};

type WhisperResponse = {
  text: string;
  language?: string;
  duration?: number;
};

/**
 * Map MIME types to file extensions for Whisper API.
 * Whisper accepts: flac, mp3, mp4, mpeg, mpga, m4a, ogg, wav, webm
 */
function getFileExtension(mimeType: string): string {
  const mimeToExt: Record<string, string> = {
    "audio/flac": "flac",
    "audio/mp3": "mp3",
    "audio/mpeg": "mp3",
    "audio/mp4": "mp4",
    "audio/m4a": "m4a",
    "audio/ogg": "ogg",
    "audio/opus": "ogg",
    "audio/wav": "wav",
    "audio/wave": "wav",
    "audio/webm": "webm",
    "audio/x-wav": "wav",
    "video/mp4": "mp4",
    "video/webm": "webm"
  };
  return mimeToExt[mimeType] ?? "ogg";
}

/**
 * Supported audio formats for OpenAI Whisper.
 */
const SUPPORTED_FORMATS = [
  "audio/flac",
  "audio/mp3",
  "audio/mpeg",
  "audio/mp4",
  "audio/m4a",
  "audio/ogg",
  "audio/opus",
  "audio/wav",
  "audio/wave",
  "audio/webm",
  "audio/x-wav",
  "video/mp4",
  "video/webm"
];

/**
 * Create an OpenAI Whisper transcription provider.
 */
export function createOpenAITranscriptionProvider(
  config: OpenAITranscriptionConfig
): TranscriptionProvider {
  const { apiKey, model = "whisper-1", baseUrl = "https://api.openai.com/v1" } = config;

  return {
    id: "openai",
    label: "OpenAI Whisper",
    supportedFormats: SUPPORTED_FORMATS,

    async transcribe(args: {
      audio: Buffer | string;
      mimeType: string;
      options?: TranscriptionOptions;
    }): Promise<TranscriptionResult> {
      const { audio, mimeType, options } = args;
      const audioBuffer = typeof audio === "string" ? Buffer.from(audio, "base64") : audio;
      const extension = getFileExtension(mimeType);
      const filename = `audio.${extension}`;

      // Build multipart form data
      const formData = new FormData();
      const blob = new Blob([audioBuffer], { type: mimeType });
      formData.append("file", blob, filename);
      formData.append("model", model);
      formData.append("response_format", "verbose_json");

      // Add optional parameters
      if (options?.language && options.language !== "auto") {
        formData.append("language", options.language);
      }
      if (options?.prompt) {
        formData.append("prompt", options.prompt);
      }

      const endpoint = `${baseUrl.replace(/\/$/, "")}/audio/transcriptions`;

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`
        },
        body: formData
      });

      if (!response.ok) {
        const errorText = await response.text();
        const error = new Error(
          `OpenAI Whisper transcription failed: ${response.status} - ${errorText}`
        ) as Error & { code?: string; provider?: string };
        error.code = `HTTP_${response.status}`;
        error.provider = "openai";
        throw error;
      }

      const data = (await response.json()) as WhisperResponse;

      return {
        text: data.text,
        language: data.language,
        duration: data.duration
      };
    }
  };
}