import { describe, expect, it } from "vitest";

import { agentPathAgent } from "../engine/agents/ops/agentPathBuild.js";
import { evalHarnessCreate } from "./evalHarness.js";

describe("evalHarnessCreate", () => {
    it("boots an in-process harness and creates an agent", async () => {
        const harness = await evalHarnessCreate();
        try {
            const ownerCtx = await harness.agentSystem.ownerCtxEnsure();
            const agentPath = agentPathAgent(ownerCtx.userId, "eval-agent");
            const creationConfig = { kind: "agent" as const, name: "eval-agent" };

            const resetResult = await harness.agentSystem.postAndAwait(
                ownerCtx,
                { path: agentPath },
                { type: "reset", message: "init eval agent" },
                creationConfig
            );

            const agentId = await harness.agentSystem.agentIdForTarget(ownerCtx, { path: agentPath }, creationConfig);
            const agentCtx = await harness.agentSystem.contextForAgentId(agentId);

            expect(resetResult).toEqual({ type: "reset", ok: true });
            expect(agentCtx?.userId).toBe(ownerCtx.userId);
            expect(await harness.agentSystem.agentExists(agentId)).toBe(true);
        } finally {
            await harness.cleanup();
        }
    });

    it("registers the full core tool catalog", async () => {
        const harness = await evalHarnessCreate();
        try {
            const toolNames = harness.agentSystem.toolResolver
                .listTools()
                .map((tool) => tool.name)
                .sort((left, right) => left.localeCompare(right));

            expect(toolNames).toHaveLength(74);
            expect(toolNames).toEqual(
                expect.arrayContaining([
                    "acp_session_message",
                    "acp_session_start",
                    "agent_ask",
                    "agent_compact",
                    "agent_reset",
                    "channel_add_member",
                    "channel_create",
                    "channel_history",
                    "channel_remove_member",
                    "channel_send",
                    "create_permanent_agent",
                    "friend_add",
                    "friend_remove",
                    "friend_send",
                    "fragment_archive",
                    "fragment_create",
                    "fragment_list",
                    "fragment_read",
                    "fragment_update",
                    "generate_image",
                    "generate_mermaid_png",
                    "generate_signal",
                    "generate_speech",
                    "inference_classify",
                    "inference_summary",
                    "list_voices",
                    "media_analyze",
                    "mini_app_create",
                    "mini_app_delete",
                    "mini_app_eject",
                    "mini_app_update",
                    "now",
                    "observation_query",
                    "pdf_process",
                    "psql_data",
                    "psql_db_create",
                    "psql_db_list",
                    "psql_query",
                    "psql_schema",
                    "read_session_history",
                    "say",
                    "secret_add",
                    "secret_copy",
                    "secret_remove",
                    "send_agent_message",
                    "send_file",
                    "send_user_message",
                    "set_agent_model",
                    "set_reaction",
                    "signal_events_csv",
                    "signal_subscribe",
                    "signal_unsubscribe",
                    "skill",
                    "skill_add",
                    "skill_eject",
                    "skill_remove",
                    "start_background_agent",
                    "start_background_workflow",
                    "task_create",
                    "task_delete",
                    "task_read",
                    "task_run",
                    "task_trigger_add",
                    "task_trigger_remove",
                    "task_update",
                    "topology",
                    "user_profile_update",
                    "vault_append",
                    "vault_patch",
                    "vault_read",
                    "vault_search",
                    "vault_tree",
                    "vault_write",
                    "workspace_create"
                ])
            );
        } finally {
            await harness.cleanup();
        }
    });
});
