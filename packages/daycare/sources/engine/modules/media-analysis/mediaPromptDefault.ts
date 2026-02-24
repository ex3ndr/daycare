import type { MediaType } from "./types.js";

const prompts: Record<MediaType, string> = {
    image: "Describe this image in detail, including key visual elements, text, and notable features.",
    video: "Describe this video in detail, including key scenes, actions, and notable elements.",
    audio: "Transcribe and describe this audio, including speech content, sounds, and notable elements.",
    pdf: "Analyze this PDF document. Summarize its content, structure, and key information."
};

/**
 * Resolves the default analysis prompt for a media category.
 * Expects: one of the supported media types.
 */
export function mediaPromptDefault(mediaType: MediaType): string {
    return prompts[mediaType];
}
