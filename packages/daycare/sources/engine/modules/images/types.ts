import type { Logger } from "pino";
import type { AuthStore } from "../../../auth/store.js";
import type { FileReference } from "../../../files/types.js";
import type { FileFolder } from "../../files/fileFolder.js";

export type ImageGenerationRequest = {
    prompt: string;
    size?: string;
    count?: number;
    format?: "b64_json" | "url";
    model?: string;
};

export type ImageGenerationResult = {
    files: FileReference[];
};

export type ImageGenerationContext = {
    fileStore: FileFolder;
    auth: AuthStore;
    logger: Logger;
};

export type ImageGenerationProvider = {
    id: string;
    label: string;
    generate: (request: ImageGenerationRequest, context: ImageGenerationContext) => Promise<ImageGenerationResult>;
};
