import {
    deleteModelRoleRule,
    listModelRoleRules,
    type ModelRoleRuleResponse,
    setModelRoleRule
} from "../engine/ipc/client.js";
import { promptConfirm, promptInput, promptSelect } from "./prompts.js";

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

const ROLE_CHOICES = [
    { value: "__none__", name: "Any role", description: "Match all roles" },
    { value: "user", name: "User", description: "User-facing agents" },
    { value: "memory", name: "Memory", description: "Memory agents" },
    { value: "memorySearch", name: "Memory Search", description: "Memory search agents" },
    { value: "subagent", name: "Subagent", description: "Subagents" },
    { value: "task", name: "Task", description: "Task agents" }
];

const KIND_CHOICES = [
    { value: "__none__", name: "Any kind", description: "Match all kinds" },
    { value: "connector", name: "Connector", description: "Messaging connectors" },
    { value: "agent", name: "Agent", description: "General agents" },
    { value: "app", name: "App", description: "App agents" },
    { value: "swarm", name: "Swarm", description: "Swarm agents" },
    { value: "cron", name: "Cron", description: "Scheduled tasks" },
    { value: "task", name: "Task", description: "Task agents" },
    { value: "subuser", name: "Subuser", description: "Sub-user agents" },
    { value: "sub", name: "Sub", description: "Subagents" },
    { value: "memory", name: "Memory", description: "Memory agents" },
    { value: "search", name: "Search", description: "Search agents" }
];

/**
 * CLI command to manage model role rules on a running engine.
 * Supports both flag-based and interactive modes.
 * Requires the engine to be running (communicates via IPC socket).
 */
export async function modelRulesCommand(options: ModelRulesCommandOptions): Promise<void> {
    // Flag-based mode for scripting
    if (options.delete) {
        await handleDelete(options.delete);
        return;
    }
    if (options.set) {
        await handleFlagSet(options);
        return;
    }
    if (options.list) {
        await handleList();
        return;
    }

    // Interactive mode
    await handleInteractive();
}

async function handleInteractive(): Promise<void> {
    const { rules } = await listModelRoleRules();
    printRules(rules);

    const actions = [{ value: "add", name: "Add rule", description: "Create a new model override rule" }];
    if (rules.length > 0) {
        actions.push(
            { value: "edit", name: "Edit rule", description: "Update an existing rule" },
            { value: "delete", name: "Delete rule", description: "Remove an existing rule" }
        );
    }

    const action = await promptSelect({ message: "What would you like to do?", choices: actions });
    if (!action) {
        return;
    }

    if (action === "add") {
        await handleInteractiveAdd();
    } else if (action === "edit") {
        await handleInteractiveEdit(rules);
    } else if (action === "delete") {
        await handleInteractiveDelete(rules);
    }
}

async function handleInteractiveAdd(): Promise<void> {
    const model = await promptInput({ message: "Model (provider/model)", placeholder: "anthropic/claude-sonnet-4-6" });
    if (!model?.trim()) {
        console.log("Cancelled.");
        return;
    }

    const role = await promptSelect({ message: "Match role?", choices: ROLE_CHOICES });
    if (role === null) {
        console.log("Cancelled.");
        return;
    }

    const kind = await promptSelect({ message: "Match kind?", choices: KIND_CHOICES });
    if (kind === null) {
        console.log("Cancelled.");
        return;
    }

    const userId = await promptInput({ message: "Match user ID? (leave empty for any)" });
    if (userId === null) {
        console.log("Cancelled.");
        return;
    }

    const agentId = await promptInput({ message: "Match agent ID? (leave empty for any)" });
    if (agentId === null) {
        console.log("Cancelled.");
        return;
    }

    const rule = await setModelRoleRule({
        role: role === "__none__" ? null : role,
        kind: kind === "__none__" ? null : kind,
        userId: userId.trim() || null,
        agentId: agentId.trim() || null,
        model: model.trim()
    });

    console.log("\nRule created:");
    printRule(rule);
}

async function handleInteractiveEdit(rules: ModelRoleRuleResponse[]): Promise<void> {
    const choices = rules.map((rule) => ({
        value: rule.id,
        name: `${ruleMatcherSummary(rule)}  →  ${rule.model}`,
        description: rule.id
    }));

    const selectedId = await promptSelect({ message: "Select rule to edit", choices });
    if (!selectedId) {
        console.log("Cancelled.");
        return;
    }

    const existing = rules.find((r) => r.id === selectedId);
    if (!existing) {
        return;
    }

    console.log("\nEditing rule:");
    printRule(existing);
    console.log("");

    const model = await promptInput({
        message: "Model (provider/model)",
        default: existing.model,
        placeholder: existing.model
    });
    if (model === null) {
        console.log("Cancelled.");
        return;
    }

    const roleDefault = existing.role ?? "__none__";
    const role = await promptSelect({
        message: "Match role?",
        choices: ROLE_CHOICES.map((c) => ({ ...c, name: c.value === roleDefault ? `${c.name} (current)` : c.name }))
    });
    if (role === null) {
        console.log("Cancelled.");
        return;
    }

    const kindDefault = existing.kind ?? "__none__";
    const kind = await promptSelect({
        message: "Match kind?",
        choices: KIND_CHOICES.map((c) => ({ ...c, name: c.value === kindDefault ? `${c.name} (current)` : c.name }))
    });
    if (kind === null) {
        console.log("Cancelled.");
        return;
    }

    const userId = await promptInput({
        message: "Match user ID? (leave empty for any)",
        default: existing.userId ?? ""
    });
    if (userId === null) {
        console.log("Cancelled.");
        return;
    }

    const agentId = await promptInput({
        message: "Match agent ID? (leave empty for any)",
        default: existing.agentId ?? ""
    });
    if (agentId === null) {
        console.log("Cancelled.");
        return;
    }

    const rule = await setModelRoleRule({
        id: selectedId,
        role: role === "__none__" ? null : role,
        kind: kind === "__none__" ? null : kind,
        userId: userId.trim() || null,
        agentId: agentId.trim() || null,
        model: model.trim() || existing.model
    });

    console.log("\nRule updated:");
    printRule(rule);
}

async function handleInteractiveDelete(rules: ModelRoleRuleResponse[]): Promise<void> {
    const choices = rules.map((rule) => ({
        value: rule.id,
        name: `${ruleMatcherSummary(rule)}  →  ${rule.model}`,
        description: rule.id
    }));

    const selectedId = await promptSelect({ message: "Select rule to delete", choices });
    if (!selectedId) {
        console.log("Cancelled.");
        return;
    }

    const existing = rules.find((r) => r.id === selectedId);
    if (existing) {
        printRule(existing);
    }

    const confirmed = await promptConfirm({ message: "Delete this rule?", default: false });
    if (!confirmed) {
        console.log("Cancelled.");
        return;
    }

    const deleted = await deleteModelRoleRule(selectedId);
    if (deleted) {
        console.log(`Rule ${selectedId} deleted.`);
    } else {
        console.log(`Rule ${selectedId} not found.`);
    }
}

async function handleList(): Promise<void> {
    const { rules } = await listModelRoleRules();
    printRules(rules);
}

async function handleFlagSet(options: ModelRulesCommandOptions): Promise<void> {
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

function printRules(rules: ModelRoleRuleResponse[]): void {
    if (rules.length === 0) {
        console.log("No model role rules configured.\n");
        return;
    }

    console.log(`\nModel role rules (${rules.length}):`);
    console.log("─".repeat(60));
    for (const rule of rules) {
        printRule(rule);
    }
    console.log("");
}

function printRule(rule: ModelRoleRuleResponse): void {
    console.log(`  ${rule.id}  ${ruleMatcherSummary(rule)}  →  ${rule.model}`);
}

function ruleMatcherSummary(rule: ModelRoleRuleResponse): string {
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
    return matchers.length > 0 ? matchers.join(", ") : "(wildcard)";
}
