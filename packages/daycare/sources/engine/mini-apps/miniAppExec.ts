import type { Context, ToolExecutionContext } from "@/types";
import { createId } from "@paralleldrive/cuid2";
import { getLogger } from "../../log.js";
import { Sandbox } from "../../sandbox/sandbox.js";
import { bundledExamplesDirResolve } from "../agents/bundledExamplesDir.js";
import type { AgentSystem } from "../agents/agentSystem.js";
import { agentSandboxBackendConfigBuild } from "../agents/ops/agentSandboxBackendConfigBuild.js";
import { UserHome } from "../users/userHome.js";
import { montyPreambleBuild } from "../modules/monty/montyPreambleBuild.js";
import { rlmExecute, type RlmExecuteResult } from "../modules/rlm/rlmExecute.js";
import { rlmToolsForContextResolve } from "../modules/rlm/rlmToolsForContextResolve.js";
import type { ToolResolverApi } from "../modules/toolResolver.js";
import { MINI_APP_TOOL_ALLOWLIST } from "./miniAppToolAllowlist.js";

const logger = getLogger("engine.mini-apps");

export type MiniAppExecOptions = {
    ctx: Context;
    appId: string;
    code: string;
    agentSystem: AgentSystem;
    toolResolver: ToolResolverApi;
};

export type MiniAppExecResult = {
    output: string;
    printOutput: string[];
    toolCallCount: number;
    error?: string;
};

/**
 * Executes Python code in the mini app context with a restricted set of tools.
 * Expects: appId identifies a valid mini app owned by ctx.userId.
 */
export async function miniAppExec(options: MiniAppExecOptions): Promise<MiniAppExecResult> {
    const { ctx, appId, code, agentSystem, toolResolver } = options;

    // Build a minimal execution context with tool allowlist for preamble generation
    const contextForPreamble: Pick<ToolExecutionContext, "ctx" | "agent" | "allowedToolNames"> = {
        ctx,
        agent: null as never,
        allowedToolNames: MINI_APP_TOOL_ALLOWLIST
    };

    // Build preamble only for allowed tools
    const allowedTools = rlmToolsForContextResolve(toolResolver, contextForPreamble);
    const preamble = montyPreambleBuild(allowedTools);

    // Create user-scoped sandbox for mini app execution
    const userHome = new UserHome(agentSystem.config.current.usersDir, ctx.userId);
    const examplesDir = bundledExamplesDirResolve();
    const extraMounts = agentSystem.extraMountsForUserId(ctx.userId);
    
    const sandbox = new Sandbox({
        homeDir: userHome.home,
        permissions: {
            read: { allowList: [`${userHome.home}/**`], denyList: [] },
            write: { allowList: [`${userHome.home}/**`], denyList: [] },
            network: true
        },
        mounts: [
            { hostPath: userHome.skillsActive, mappedPath: "/shared/skills" },
            ...(examplesDir ? [{ hostPath: examplesDir, mappedPath: "/shared/examples" }] : []),
            ...extraMounts
        ],
        backend: agentSandboxBackendConfigBuild(agentSystem.config.current.settings, ctx.userId)
    });

    // Create a minimal ToolExecutionContext for execution
    const fullContext: ToolExecutionContext = {
        ctx,
        agent: null as never,
        agentSystem,
        allowedToolNames: MINI_APP_TOOL_ALLOWLIST,
        connectorRegistry: agentSystem.connectorRegistry,
        sandbox,
        auth: agentSystem.auth,
        logger,
        assistant: null,
        source: `mini-app:${appId}`,
        messageContext: {
            type: "direct"
        },
        pythonExecution: true,
        storage: agentSystem.storage,
        secrets: agentSystem.secrets
    };

    const toolCallId = createId();

    try {
        const result: RlmExecuteResult = await rlmExecute(
            code,
            preamble,
            fullContext,
            toolResolver,
            toolCallId
            // No historyCallback - we don't need to persist history for mini apps
        );

        return {
            output: result.output,
            printOutput: result.printOutput,
            toolCallCount: result.toolCallCount
        };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
            output: "",
            printOutput: [],
            toolCallCount: 0,
            error: errorMessage
        };
    }
}
