import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { Type } from "@sinclair/typebox";
import { renderMermaid, THEMES } from "beautiful-mermaid";

import type { ToolDefinition, ToolResultContract } from "@/types";
import { sanitizeFilename } from "../../../util/filename.js";
import { renderToPng } from "../../../util/renderToPng.js";

const schema = Type.Object(
    {
        mermaid: Type.String({ minLength: 1 }),
        name: Type.Optional(Type.String({ minLength: 1 })),
        theme: Type.Optional(Type.String({ minLength: 1 })),
        width: Type.Optional(Type.Integer({ minimum: 256, maximum: 4096 }))
    },
    { additionalProperties: false }
);

type MermaidPngArgs = {
    mermaid: string;
    name?: string;
    theme?: string;
    width?: number;
};

const mermaidPngResultSchema = Type.Object(
    {
        summary: Type.String(),
        fileId: Type.String(),
        fileName: Type.String(),
        theme: Type.String(),
        width: Type.Number()
    },
    { additionalProperties: false }
);

type MermaidPngResult = {
    summary: string;
    fileId: string;
    fileName: string;
    theme: string;
    width: number;
};

const mermaidPngReturns: ToolResultContract<MermaidPngResult> = {
    schema: mermaidPngResultSchema,
    toLLMText: (result) => result.summary
};

/**
 * Builds a tool that renders Mermaid diagram source into a PNG file.
 * Expects: args.mermaid contains raw Mermaid source without markdown fences.
 */
export function buildMermaidPngTool(): ToolDefinition<typeof schema> {
    return {
        tool: {
            name: "generate_mermaid_png",
            description: "Render raw Mermaid diagram source into a PNG file and return it as a generated artifact.",
            parameters: schema
        },
        returns: mermaidPngReturns,
        execute: async (args, context, toolCall) => {
            const payload = args as MermaidPngArgs;
            const themeName = payload.theme ?? "github-light";
            const theme = THEMES[themeName as keyof typeof THEMES];
            if (!theme) {
                const available = Object.keys(THEMES).sort().join(", ");
                throw new Error(`Unknown Mermaid theme: ${themeName}. Available themes: ${available}`);
            }

            const diagram = payload.mermaid.trim();
            if (diagram.length === 0) {
                throw new Error("Mermaid source is empty.");
            }
            if (diagram.includes("```")) {
                throw new Error("Provide raw Mermaid source without ``` fences.");
            }

            const svg = await renderMermaid(diagram, theme);
            const png = await renderToPng(svg, {
                width: payload.width ?? 1600
            });
            const fileName = sanitizeFilename(mermaidPngNameResolve(payload.name));
            const targetPath = `~/downloads/${fileName}`;
            const stored = await context.sandbox.write({
                path: targetPath,
                content: png
            });

            const summary = `Generated Mermaid PNG: ${stored.sandboxPath}`;
            const toolMessage: ToolResultMessage = {
                role: "toolResult",
                toolCallId: toolCall.id,
                toolName: toolCall.name,
                content: [
                    {
                        type: "text",
                        text: summary
                    }
                ],
                details: {
                    fileId: stored.sandboxPath,
                    name: fileName,
                    mimeType: "image/png",
                    size: stored.bytes,
                    path: stored.sandboxPath,
                    resolvedPath: stored.resolvedPath,
                    theme: themeName,
                    width: payload.width ?? 1600
                },
                isError: false,
                timestamp: Date.now()
            };

            return {
                toolMessage,
                typedResult: {
                    summary,
                    fileId: stored.sandboxPath,
                    fileName,
                    theme: themeName,
                    width: payload.width ?? 1600
                }
            };
        }
    };
}

function mermaidPngNameResolve(requestedName?: string): string {
    const fallback = `mermaid-${Date.now()}.png`;
    if (!requestedName) {
        return fallback;
    }

    const trimmed = requestedName.trim();
    if (trimmed.length === 0) {
        return fallback;
    }
    if (trimmed.toLowerCase().endsWith(".png")) {
        return trimmed;
    }
    return `${trimmed}.png`;
}
