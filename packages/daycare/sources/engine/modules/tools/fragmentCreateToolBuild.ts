import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { createId } from "@paralleldrive/cuid2";
import { type Static, Type } from "@sinclair/typebox";
import type { ToolDefinition, ToolResultContract } from "@/types";
import { fragmentCodeVerify } from "../../../fragments/fragmentCodeVerify.js";
import { fragmentSpecIssuesFormat, fragmentSpecValidate } from "../../../fragments/fragmentSpecValidate.js";

const schema = Type.Object(
    {
        title: Type.String({ minLength: 1 }),
        kitVersion: Type.String({ minLength: 1 }),
        spec: Type.Object({}, { additionalProperties: true }),
        description: Type.Optional(Type.String())
    },
    { additionalProperties: false }
);

type FragmentCreateArgs = Static<typeof schema>;

const resultSchema = Type.Object(
    {
        summary: Type.String(),
        fragmentId: Type.String(),
        version: Type.Number()
    },
    { additionalProperties: false }
);

type FragmentCreateResult = Static<typeof resultSchema>;

const returns: ToolResultContract<FragmentCreateResult> = {
    schema: resultSchema,
    toLLMText: (result) => result.summary
};

/**
 * Builds the fragment_create tool for creating new UI fragment records.
 * Expects: storage.fragments is available and scoped by ctx user.
 */
export function fragmentCreateToolBuild(): ToolDefinition {
    return {
        tool: {
            name: "fragment_create",
            description: "Create a UI fragment from title, kitVersion, spec, and optional description.",
            parameters: schema
        },
        returns,
        hiddenByDefault: true,
        execute: async (args, toolContext, toolCall) => {
            const storage = toolContext.storage ?? toolContext.agentSystem.storage;
            if (!storage) {
                throw new Error("Storage is not available.");
            }

            const payload = args as FragmentCreateArgs;
            const title = typeof payload.title === "string" ? payload.title.trim() : "";
            if (!title) {
                throw new Error("title is required.");
            }

            const kitVersion = typeof payload.kitVersion === "string" ? payload.kitVersion.trim() : "";
            if (!kitVersion) {
                throw new Error("kitVersion is required.");
            }

            const spec = payload.spec;
            if (!spec || typeof spec !== "object" || Array.isArray(spec)) {
                throw new Error("spec is required.");
            }

            const validation = fragmentSpecValidate(spec);
            if (!validation.valid) {
                throw new Error(`Invalid spec:\n${fragmentSpecIssuesFormat(validation.issues)}`);
            }
            const codeError = fragmentCodeVerify(spec);
            if (codeError) {
                throw new Error(codeError);
            }

            const description = typeof payload.description === "string" ? payload.description.trim() : undefined;
            const now = Date.now();
            const created = await storage.fragments.create(toolContext.ctx, {
                id: createId(),
                kitVersion,
                title,
                description,
                spec,
                createdAt: now,
                updatedAt: now
            });
            const version = created.version ?? 1;
            const summary = `Created fragment: ${created.id} (version ${version}).`;
            const toolMessage: ToolResultMessage = {
                role: "toolResult",
                toolCallId: toolCall.id,
                toolName: toolCall.name,
                content: [{ type: "text", text: summary }],
                isError: false,
                timestamp: Date.now()
            };

            return {
                toolMessage,
                typedResult: {
                    summary,
                    fragmentId: created.id,
                    version
                }
            };
        }
    };
}
