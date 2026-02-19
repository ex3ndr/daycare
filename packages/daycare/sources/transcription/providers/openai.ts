import { promises as fs } from "node:fs";

import type {
  TranscriptionProvider,
  TranscriptionResult,
  TranscriptionOptions
} from "../types.js";

export type OpenAITranscriptionConfig = {
  apiKey: string;
  model?: string;
  baseUrl?: string;
};

const DEFAULT_MODEL = "whisper-1";
const DEFAULT_BASE_URL = "https://api.openai.com/v1";

/**
 * Creates an OpenAI Whisper transcription provider.
 * Supports audio formats: flac, mp3, mp4, mpeg, mpga, m4a, ogg, wav, webm
 */
export function createOpenAITranscriptionProvider(
  config: OpenAITranscriptionConfig
): TranscriptionProvider {
  const { apiKey, model = DEFAULT_MODEL, baseUrl = DEFAULT_BASE_URL } = config;

  return {
    id: "openai",
    name: "OpenAI Whisper",

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
      formData.append("model", model);
      formData.append("response_format", "verbose_json");

      // Add language if specified
      if (options?.language && options.language !== "auto") {
        formData.append("language", options.language);
      }

      // Add prompt if specified
      if (options?.prompt) {
        formData.append("prompt", options.prompt);
      }

      const response = await fetch(`${baseUrl}/audio/transcriptions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`
        },
        body: formData
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenAI transcription failed: ${response.status} ${errorText}`);
      }

      const data = (await response.json()) as OpenAITranscriptionResponse;

      return {
        text: data.text,
        language: data.language,
        duration: data.duration,
        raw: data
      };
    }
  };
}

type OpenAITranscriptionResponse = {
  text: string;
  language?: string;
  duration?: number;
  segments?: Array<{
    id: number;
    start: number;
    end: number;
    text: string;
  }>;
};

function mimeTypeToExtension(mimeType: string): string {
  const map: Record<string, string> = {
    "audio/ogg": "ogg",
    "audio/mpeg": "mp3",
    "audio/mp3": "mp3",
    "audio/mp4": "mp4",
    "audio/m4a": "m4a",
    "audio/wav": "wav",
    "audio/wave": "wav",
    "audio/x-wav": "wav",
    "audio/webm": "webm",
    "audio/flac": "flac",
    "application/ogg": "ogg"
  };
  return map[mimeType] ?? "mp3";
}

export default createOpenAITranscriptionProvider;