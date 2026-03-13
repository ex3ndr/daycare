import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { type Static, Type } from "@sinclair/typebox";
import type { ToolDefinition, ToolResultContract } from "@/types";
import { fragmentCodeVerify } from "../../../fragments/fragmentCodeVerify.js";
import { fragmentSpecIssuesFormat, fragmentSpecValidate } from "../../../fragments/fragmentSpecValidate.js";
import type { FragmentUpdateInput } from "../../../storage/fragmentsRepository.js";

const schema = Type.Object(
    {
        fragmentId: Type.String({ minLength: 1 }),
        title: Type.Optional(Type.String()),
        description: Type.Optional(Type.String()),
        spec: Type.Optional(Type.Object({}, { additionalProperties: true })),
        kitVersion: Type.Optional(Type.String())
    },
    { additionalProperties: false }
);

type FragmentUpdateArgs = Static<typeof schema>;

const resultSchema = Type.Object(
    {
        summary: Type.String(),
        fragmentId: Type.String(),
        version: Type.Number()
    },
    { additionalProperties: false }
);

type FragmentUpdateResult = Static<typeof resultSchema>;

const returns: ToolResultContract<FragmentUpdateResult> = {
    schema: resultSchema,
    toLLMText: (result) => result.summary
};

/**
 * Builds the fragment_update tool for mutating existing fragment fields.
 * Expects: fragmentId is provided and at least one update field is set.
 */
export function fragmentUpdateToolBuild(): ToolDefinition {
    return {
        tool: {
            name: "fragment_update",
            description: "Update a fragment by id with partial title, description, spec, or kitVersion fields.",
            parameters: schema
        },
        returns,
        hiddenByDefault: true,
        execute: async (args, toolContext, toolCall) => {
            const storage = toolContext.storage ?? toolContext.agentSystem.storage;
            if (!storage) {
                throw new Error("Storage is not available.");
            }

            const payload = args as FragmentUpdateArgs;
            const fragmentId = typeof payload.fragmentId === "string" ? payload.fragmentId.trim() : "";
            if (!fragmentId) {
                throw new Error("fragmentId is required.");
            }

            const changes: FragmentUpdateInput = {};
            if (payload.title !== undefined) {
                const title = payload.title.trim();
                if (!title) {
                    throw new Error("title must be a non-empty string.");
                }
                changes.title = title;
            }

            if (payload.description !== undefined) {
                changes.description = payload.description.trim();
            }

            if (payload.kitVersion !== undefined) {
                const kitVersion = payload.kitVersion.trim();
                if (!kitVersion) {
                    throw new Error("kitVersion must be a non-empty string.");
                }
                changes.kitVersion = kitVersion;
            }

            if (payload.spec !== undefined) {
                const spec = payload.spec;
                if (!spec || typeof spec !== "object" || Array.isArray(spec)) {
                    throw new Error("spec must be an object.");
                }
                const validation = fragmentSpecValidate(spec);
                if (!validation.valid) {
                    throw new Error(`Invalid spec:\n${fragmentSpecIssuesFormat(validation.issues)}`);
                }
                const codeError = fragmentCodeVerify(spec);
                if (codeError) {
                    throw new Error(codeError);
                }
                changes.spec = spec;
            }

            if (Object.keys(changes).length === 0) {
                throw new Error("At least one field is required: title, description, spec, or kitVersion.");
            }

            changes.updatedAt = Date.now();
            const updated = await storage.fragments.update(toolContext.ctx, fragmentId, changes);
            const version = updated.version ?? 1;
            const summary = `Updated fragment: ${updated.id} (version ${version}).`;
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
                    fragmentId: updated.id,
                    version
                }
            };
        }
    };
}
