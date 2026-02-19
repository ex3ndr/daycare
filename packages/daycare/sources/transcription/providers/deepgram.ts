import { promises as fs } from "node:fs";

import type {
  TranscriptionProvider,
  TranscriptionResult,
  TranscriptionOptions
} from "../types.js";

export type DeepgramTranscriptionConfig = {
  apiKey: string;
  model?: string;
};

const DEFAULT_MODEL = "nova-2";
const BASE_URL = "https://api.deepgram.com/v1";

/**
 * Creates a Deepgram transcription provider.
 * Deepgram supports most audio formats and provides fast, accurate transcription.
 */
export function createDeepgramTranscriptionProvider(
  config: DeepgramTranscriptionConfig
): TranscriptionProvider {
  const { apiKey, model = DEFAULT_MODEL } = config;

  return {
    id: "deepgram",
    name: "Deepgram",

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

      // Build query params
      const params = new URLSearchParams({
        model,
        smart_format: "true",
        punctuate: "true"
      });

      // Add language if specified
      if (options?.language && options.language !== "auto") {
        params.set("language", options.language);
      } else {
        params.set("detect_language", "true");
      }

      const response = await fetch(
        `${BASE_URL}/listen?${params.toString()}`,
        {
          method: "POST",
          headers: {
            Authorization: `Token ${apiKey}`,
            "Content-Type": mimeType
          },
          body: audioBuffer
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Deepgram transcription failed: ${response.status} ${errorText}`);
      }

      const data = (await response.json()) as DeepgramResponse;

      const result = data.results?.channels?.[0]?.alternatives?.[0];
      const metadata = data.metadata;

      return {
        text: result?.transcript ?? "",
        language: metadata?.detected_language,
        duration: metadata?.duration,
        confidence: result?.confidence,
        raw: data
      };
    }
  };
}

type DeepgramResponse = {
  metadata?: {
    duration?: number;
    detected_language?: string;
  };
  results?: {
    channels?: Array<{
      alternatives?: Array<{
        transcript: string;
        confidence: number;
      }>;
    }>;
  };
};

export default createDeepgramTranscriptionProvider;