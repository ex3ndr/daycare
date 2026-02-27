import path from "node:path";
import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { Type } from "@sinclair/typebox";
import type { ToolDefinition, ToolResultContract } from "@/types";
import { FileFolder } from "../../files/fileFolder.js";
import type { SpeechGenerationRegistry } from "../speechGenerationRegistry.js";

const schema = Type.Object(
    {
        provider: Type.Optional(Type.String({ minLength: 1 }))
    },
    { additionalProperties: false }
);

const voiceListResultSchema = Type.Object(
    {
        summary: Type.String(),
        voices: Type.Array(
            Type.Object(
                {
                    id: Type.String(),
                    description: Type.String(),
                    provider: Type.String()
                },
                { additionalProperties: false }
            )
        )
    },
    { additionalProperties: false }
);

type VoiceListResult = {
    summary: string;
    voices: Array<{
        id: string;
        description: string;
        provider: string;
    }>;
};

const voiceListReturns: ToolResultContract<VoiceListResult> = {
    schema: voiceListResultSchema,
    toLLMText: (result) => result.summary
};

/**
 * Builds the speech voice listing tool by querying providers with optional voice discovery APIs.
 * Expects: at least one speech provider is registered in the speech registry.
 */
export function buildVoiceListTool(speechRegistry: SpeechGenerationRegistry): ToolDefinition {
    return {
        tool: {
            name: "list_voices",
            description: "List available speech synthesis voices from registered speech providers.",
            parameters: schema
        },
        returns: voiceListReturns,
        execute: async (args, toolContext, toolCall) => {
            const payload = args as { provider?: string };
            const providers = speechRegistry.list();
            if (providers.length === 0) {
                throw new Error("No speech generation providers available");
            }
            const selectedProviders = providerSelect(speechRegistry, providers, payload.provider);
            const tempFileStore = new FileFolder(path.join(toolContext.sandbox.homeDir, "tmp", "speech-generation"));

            const voices: VoiceListResult["voices"] = [];
            const notes: string[] = [];
            for (const provider of selectedProviders) {
                if (!provider.listVoices) {
                    notes.push(`Provider ${provider.id} does not support voice listing.`);
                    continue;
                }
                const listed = await provider.listVoices({
                    fileStore: tempFileStore,
                    auth: toolContext.auth,
                    logger: toolContext.logger
                });
                for (const voice of listed) {
                    voices.push({
                        id: voice.id,
                        description: voice.description,
                        provider: provider.id
                    });
                }
            }

            let summary = `Found ${voices.length} voice(s) from ${selectedProviders.length} provider(s).`;
            if (notes.length > 0) {
                summary = `${summary} ${notes.join(" ")}`;
            }

            const toolMessage: ToolResultMessage = {
                role: "toolResult",
                toolCallId: toolCall.id,
                toolName: toolCall.name,
                content: [{ type: "text", text: summary }],
                details: {
                    providers: selectedProviders.map((provider) => provider.id),
                    voices,
                    notes
                },
                isError: false,
                timestamp: Date.now()
            };

            return {
                toolMessage,
                typedResult: {
                    summary,
                    voices
                }
            };
        }
    };
}

function providerSelect(
    speechRegistry: SpeechGenerationRegistry,
    providers: ReturnType<SpeechGenerationRegistry["list"]>,
    providerId?: string
) {
    if (!providerId) {
        return providers;
    }
    const provider = speechRegistry.get(providerId);
    if (!provider) {
        throw new Error(`Unknown speech provider: ${providerId}`);
    }
    return [provider];
}
