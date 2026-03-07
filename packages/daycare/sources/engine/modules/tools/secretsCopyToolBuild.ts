import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { type Static, Type } from "@sinclair/typebox";
import type { ToolDefinition, ToolResultContract } from "@/types";
import { contextForUser } from "../../agents/context.js";
import { workspaceOwnedUserResolve } from "./workspaceOwnedUserResolve.js";

const schema = Type.Object(
    {
        userId: Type.String({ minLength: 1 }),
        secret: Type.String({ minLength: 1 })
    },
    { additionalProperties: false }
);

type SecretsCopyArgs = Static<typeof schema>;

const resultSchema = Type.Object(
    {
        summary: Type.String(),
        userId: Type.String(),
        secret: Type.String(),
        status: Type.String()
    },
    { additionalProperties: false }
);

type SecretsCopyResult = Static<typeof resultSchema>;

const returns: ToolResultContract<SecretsCopyResult> = {
    schema: resultSchema,
    toLLMText: (result) => result.summary
};

/**
 * Copies one named secret from the owner user to a target owned workspace user.
 * Expects: caller is owner and userId belongs to a workspace owned by caller.
 */
export function secretCopyToolBuild(): ToolDefinition {
    return {
        tool: {
            name: "secret_copy",
            description: "Copy one named secret from your user to a target workspace user.",
            parameters: schema
        },
        returns,
        visibleByDefault: (context) => context.config.foreground === true,
        execute: async (args, toolContext, toolCall) => {
            const payload = args as SecretsCopyArgs;
            if (!toolContext.secrets) {
                throw new Error("Secrets service is not configured.");
            }

            const workspaceUser = await workspaceOwnedUserResolve({
                toolContext,
                userId: payload.userId,
                ownerError: "Only the owner user can copy secrets to workspaces."
            });
            const requestedName = payload.secret.trim();
            if (!requestedName) {
                throw new Error("secret is required.");
            }
            const ownerSecrets = await toolContext.secrets.list(toolContext.ctx);
            const ownerSecretsByName = new Map(ownerSecrets.map((secret) => [secret.name, secret]));
            const workspaceCtx = contextForUser({ userId: workspaceUser.id });
            const secret = ownerSecretsByName.get(requestedName);
            if (!secret) {
                throw new Error(`Secret not found: "${requestedName}".`);
            }
            await toolContext.secrets.add(workspaceCtx, {
                name: secret.name,
                displayName: secret.displayName,
                description: secret.description,
                variables: { ...secret.variables }
            });

            const summary = `Copied secret "${requestedName}" to workspace "${workspaceUser.id}".`;
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
                    userId: workspaceUser.id,
                    secret: requestedName,
                    status: "copied"
                }
            };
        }
    };
}
