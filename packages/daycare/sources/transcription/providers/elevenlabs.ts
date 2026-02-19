/**
 * ElevenLabs Scribe transcription provider.
 * Uses the ElevenLabs Speech-to-Text API for transcription.
 */

import { promises as fs } from "node:fs";

import type {
  TranscriptionProvider,
  TranscriptionResult,
  TranscriptionOptions
} from "../types.js";

export type ElevenLabsTranscriptionConfig = {
  apiKey: string;
  /** Model to use: "scribe_v1" or "scribe_v2" (default). */
  model?: "scribe_v1" | "scribe_v2";
};

const DEFAULT_MODEL = "scribe_v2";
const BASE_URL = "https://api.elevenlabs.io/v1";

/**
 * Creates an ElevenLabs Scribe transcription provider.
 * Supports 90+ languages with word-level timestamps.
 */
export function createElevenLabsTranscriptionProvider(
  config: ElevenLabsTranscriptionConfig
): TranscriptionProvider {
  const { apiKey, model = DEFAULT_MODEL } = config;

  return {
    id: "elevenlabs",
    name: "ElevenLabs Scribe",

    async transcribe(
      audio: Buffer | string,
      mimeType: string,
      options?: TranscriptionOptions
    ): Promise<TranscriptionResult> {
      // Read file if path provided
      let audioBuffer: Buffer;
      if (typeof audio === "string") {
        audioBuffer = await fs.readFile(audio);
      } else {
        audioBuffer = audio;
      }

      const extension = mimeTypeToExtension(mimeType);
      const filename = `audio.${extension}`;

      // Build multipart form data
      const formData = new FormData();
      const blob = new Blob([audioBuffer], { type: mimeType });
      formData.append("file", blob, filename);
      formData.append("model_id", model);

      // Add language if specified
      if (options?.language && options.language !== "auto") {
        formData.append("language_code", options.language);
      }

      const response = await fetch(`${BASE_URL}/speech-to-text`, {
        method: "POST",
        headers: {
          "xi-api-key": apiKey
        },
        body: formData
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`ElevenLabs transcription failed: ${response.status} ${errorText}`);
      }

      const data = (await response.json()) as ElevenLabsResponse;

      // Calculate duration from last word timestamp if available
      let duration: number | undefined;
      if (data.words && data.words.length > 0) {
        const lastWord = data.words[data.words.length - 1];
        if (lastWord.end !== undefined) {
          duration = lastWord.end;
        }
      }

      return {
        text: data.text,
        language: data.language_code ?? data.languageCode,
        duration,
        confidence: data.language_probability ?? data.languageProbability,
        raw: data
      };
    }
  };
}

type ElevenLabsResponse = {
  text: string;
  language_code?: string;
  languageCode?: string;
  language_probability?: number;
  languageProbability?: number;
  words?: Array<{ end?: number }>;
};

function mimeTypeToExtension(mimeType: string): string {
  const map: Record<string, string> = {
    "audio/mpeg": "mp3",
    "audio/mp3": "mp3",
    "audio/mp4": "m4a",
    "audio/x-m4a": "m4a",
    "audio/m4a": "m4a",
    "audio/wav": "wav",
    "audio/wave": "wav",
    "audio/x-wav": "wav",
    "audio/webm": "webm",
    "audio/ogg": "ogg",
    "audio/opus": "opus",
    "audio/flac": "flac",
    "audio/x-flac": "flac",
    "audio/aiff": "aiff",
    "video/mp4": "mp4",
    "video/webm": "webm"
  };
  return map[mimeType] ?? "mp3";
}

export default createElevenLabsTranscriptionProvider;