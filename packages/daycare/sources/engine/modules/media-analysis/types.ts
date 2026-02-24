import type { Logger } from "pino";
import type { AuthStore } from "../../../auth/store.js";

export type MediaType = "image" | "video" | "audio" | "pdf";

export type MediaAnalysisRequest = {
    filePath: string;
    mimeType: string;
    mediaType: MediaType;
    prompt: string;
    model?: string;
};

export type MediaAnalysisResult = {
    text: string;
};

export type MediaAnalysisContext = {
    auth: AuthStore;
    logger: Logger;
};

export type MediaAnalysisProvider = {
    id: string;
    label: string;
    supportedTypes: MediaType[];
    analyze: (request: MediaAnalysisRequest, context: MediaAnalysisContext) => Promise<MediaAnalysisResult>;
};
