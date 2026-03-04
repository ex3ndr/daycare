import {
    deleteModelRoleRule,
    listModelRoleRules,
    type ModelRoleRuleResponse,
    setModelRoleRule
} from "../engine/ipc/client.js";

export type ModelRulesCommandOptions = {
    list?: boolean;
    set?: boolean;
    delete?: string;
    role?: string;
    kind?: string;
    userId?: string;
    agentId?: string;
    model?: string;
    id?: string;
};

/**
 * CLI command to manage model role rules on a running engine.
 * Requires the engine to be running (communicates via IPC socket).
 */
export async function modelRulesCommand(options: ModelRulesCommandOptions): Promise<void> {
    if (options.delete) {
        await handleDelete(options.delete);
        return;
    }

    if (options.set) {
        await handleSet(options);
        return;
    }

    // Default: list rules
    await handleList();
}

async function handleList(): Promise<void> {
    const { rules } = await listModelRoleRules();
    if (rules.length === 0) {
        console.log("No model role rules configured.");
        console.log(
            "Use --set to create a rule: daycare model-rules --set --role user --model anthropic/claude-opus-4-6"
        );
        return;
    }

    console.log(`Model role rules (${rules.length}):\n`);
    for (const rule of rules) {
        printRule(rule);
    }
}

async function handleSet(options: ModelRulesCommandOptions): Promise<void> {
    if (!options.model) {
        console.error("Error: --model is required when using --set");
        console.error("Example: daycare model-rules --set --role user --model anthropic/claude-opus-4-6");
        process.exitCode = 1;
        return;
    }

    const rule = await setModelRoleRule({
        id: options.id,
        role: options.role ?? null,
        kind: options.kind ?? null,
        userId: options.userId ?? null,
        agentId: options.agentId ?? null,
        model: options.model
    });

    console.log(options.id ? "Rule updated:" : "Rule created:");
    printRule(rule);
}

async function handleDelete(id: string): Promise<void> {
    const deleted = await deleteModelRoleRule(id);
    if (deleted) {
        console.log(`Rule ${id} deleted.`);
    } else {
        console.log(`Rule ${id} not found.`);
    }
}

function printRule(rule: ModelRoleRuleResponse): void {
    const matchers: string[] = [];
    if (rule.role) {
        matchers.push(`role=${rule.role}`);
    }
    if (rule.kind) {
        matchers.push(`kind=${rule.kind}`);
    }
    if (rule.userId) {
        matchers.push(`userId=${rule.userId}`);
    }
    if (rule.agentId) {
        matchers.push(`agentId=${rule.agentId}`);
    }
    const matcherStr = matchers.length > 0 ? matchers.join(", ") : "(wildcard)";
    console.log(`  ${rule.id}  ${matcherStr}  →  ${rule.model}`);
}
