import type { FileReference } from "@/types";
import type { TranscriptionRegistry } from "../../transcription/registry.js";
import { getLogger } from "../../log.js";

const logger = getLogger("engine.transcribe");

/**
 * Audio MIME types that can be transcribed.
 */
const TRANSCRIBABLE_MIME_TYPES = new Set([
  "audio/ogg",
  "audio/mpeg",
  "audio/mp3",
  "audio/mp4",
  "audio/wav",
  "audio/webm",
  "audio/flac",
  "audio/x-m4a",
  "application/ogg"
]);

/**
 * Check if a file is transcribable based on its MIME type.
 */
export function isTranscribableAudio(mimeType: string): boolean {
  return (
    TRANSCRIBABLE_MIME_TYPES.has(mimeType) ||
    mimeType.startsWith("audio/")
  );
}

export type TranscriptionResultEntry = {
  file: FileReference;
  text: string;
  duration?: number;
  language?: string;
};

/**
 * Transcribe audio files using the transcription registry.
 * Returns transcription results for each successfully transcribed file.
 * Errors are logged but do not fail the overall operation.
 */
export async function transcribeAudioFiles(
  files: FileReference[],
  registry: TranscriptionRegistry,
  providerId?: string
): Promise<TranscriptionResultEntry[]> {
  const audioFiles = files.filter((f) => isTranscribableAudio(f.mimeType));

  if (audioFiles.length === 0) {
    return [];
  }

  const targetProvider = providerId ?? "openai";
  const provider = registry.get(targetProvider);

  if (!provider) {
    logger.debug(
      `skip: No transcription provider available providerId=${targetProvider} audioFileCount=${audioFiles.length}`
    );
    return [];
  }

  const results: TranscriptionResultEntry[] = [];

  for (const file of audioFiles) {
    try {
      logger.debug(
        `transcribe: Starting transcription fileId=${file.id} fileName=${file.name} mimeType=${file.mimeType} providerId=${targetProvider}`
      );

      const result = await registry.transcribe(targetProvider, file.path, file.mimeType);

      results.push({
        file,
        text: result.text,
        duration: result.duration,
        language: result.language
      });

      logger.debug(
        `transcribe: Transcription complete fileId=${file.id} textLength=${result.text.length} duration=${result.duration ?? "unknown"}`
      );
    } catch (error) {
      logger.warn(
        { error, fileId: file.id, fileName: file.name },
        "error: Transcription failed for audio file"
      );
      // Continue with other files
    }
  }

  return results;
}