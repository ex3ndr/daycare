import type { Logger } from "pino";
import type { AuthStore } from "../../../auth/store.js";
import type { FileReference } from "../../../files/types.js";
import type { FileFolder } from "../../files/fileFolder.js";

export type SpeechGenerationRequest = {
    text: string;
    voice?: string;
    speed?: number;
    language?: string;
    outputFormat?: string;
    model?: string;
};

export type SpeechGenerationResult = {
    files: FileReference[];
};

export type SpeechGenerationContext = {
    fileStore: FileFolder;
    auth: AuthStore;
    logger: Logger;
};

export type SpeechVoice = {
    id: string;
    description: string;
    name?: string;
    language?: string;
    preview?: string;
};

export type SpeechGenerationProvider = {
    id: string;
    label: string;
    generate: (request: SpeechGenerationRequest, context: SpeechGenerationContext) => Promise<SpeechGenerationResult>;
    listVoices?: (context: SpeechGenerationContext) => Promise<SpeechVoice[]>;
};
