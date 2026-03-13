import path from "node:path";
import type { Context, ThinkingLevel } from "@mariozechner/pi-ai";

import { AuthStore } from "../auth/store.js";
import { configLoad } from "../config/configLoad.js";
import { configResolve } from "../config/configResolve.js";
import { ConfigModule } from "../engine/config/configModule.js";
import { FileFolder } from "../engine/files/fileFolder.js";
import {
    deleteModelRoleRule,
    listModelRoleRules,
    type ModelRoleRuleResponse,
    setModelRoleRule
} from "../engine/ipc/client.js";
import { ImageGenerationRegistry } from "../engine/modules/imageGenerationRegistry.js";
import { InferenceRouter } from "../engine/modules/inference/router.js";
import { InferenceRegistry } from "../engine/modules/inferenceRegistry.js";
import { getLogger } from "../log.js";
import { getProviderDefinition } from "../providers/catalog.js";
import {
    BUILTIN_MODEL_FLAVORS,
    type BuiltinModelFlavor,
    DEFAULT_SETTINGS_PATH,
    listProviders,
    type ModelRoleKey,
    type ModelSelectionConfig,
    type ProviderSettings,
    REASONING_LEVELS,
    readSettingsFile,
    type SettingsConfig,
    updateSettingsFile
} from "../settings.js";
import type {
    ModelRoleRuleCreateInput,
    ModelRoleRuleDbRecord,
    ModelRoleRuleUpdateInput
} from "../storage/modelRoleRulesRepository.js";
import { storageOpen } from "../storage/storageOpen.js";
import { engineReloadRequest } from "./engineReloadRequest.js";
import { promptConfirm, promptInput, promptSelect } from "./prompts.js";
import { validationSessionIdCreate } from "./validationSessionIdCreate.js";

export type ModelsCommandOptions = {
    settings?: string;
    list?: boolean;
};

const ROLE_LABELS: Record<ModelRoleKey, string> = {
    user: "User-facing agents",
    memory: "Memory agent",
    memorySearch: "Memory search agent",
    subagent: "Subagents",
    task: "Task agents"
};

const ROLE_KEYS: ModelRoleKey[] = ["user", "memory", "memorySearch", "subagent", "task"];
const BUILTIN_FLAVOR_KEYS: BuiltinModelFlavor[] = ["small", "normal", "large"];

const ADD_CUSTOM_FLAVOR_CHOICE = "__add_custom_flavor__";
const ADD_OVERRIDE_RULE_CHOICE = "__add_override_rule__";
const EDIT_OVERRIDE_RULE_CHOICE = "__edit_override_rule__";
const DELETE_OVERRIDE_RULE_CHOICE = "__delete_override_rule__";
const AUTO_REASONING_CHOICE = "__auto_reasoning__";

const RULE_ROLE_CHOICES = [
    { value: "__none__", name: "Any role", description: "Match all roles" },
    { value: "user", name: "User", description: "User-facing agents" },
    { value: "memory", name: "Memory", description: "Memory agents" },
    { value: "memorySearch", name: "Memory Search", description: "Memory search agents" },
    { value: "subagent", name: "Subagent", description: "Subagents" },
    { value: "task", name: "Task", description: "Task agents" }
];

const RULE_KIND_CHOICES = [
    { value: "__none__", name: "Any kind", description: "Match all kinds" },
    { value: "connector", name: "Connector", description: "Messaging connectors" },
    { value: "agent", name: "Agent", description: "General agents" },
    { value: "app", name: "App", description: "App agents" },
    { value: "cron", name: "Cron", description: "Scheduled tasks" },
    { value: "task", name: "Task", description: "Task agents" },
    { value: "subuser", name: "Subuser", description: "Sub-user agents" },
    { value: "sub", name: "Sub", description: "Subagents" },
    { value: "memory", name: "Memory", description: "Memory agents" },
    { value: "search", name: "Search", description: "Search agents" },
    { value: "supervisor", name: "Supervisor", description: "Singleton supervisor agents" }
];

export type ModelAssignmentTarget = { type: "role"; key: ModelRoleKey } | { type: "flavor"; key: string };

/**
 * CLI command to view and configure role model assignments and flavor mappings.
 * Validates models on the fly before saving.
 */
export async function modelsCommand(options: ModelsCommandOptions): Promise<void> {
    const settingsPath = path.resolve(options.settings ?? DEFAULT_SETTINGS_PATH);
    const settings = await readSettingsFile(settingsPath);
    const config = await configLoad(settingsPath);
    const ruleStore = await ruleStoreOpen(config);

    const configured = listProviders(settings).filter((p) => p.enabled !== false);
    if (configured.length === 0) {
        console.log("No configured providers. Run 'daycare add' first.");
        return;
    }

    const defaultProvider = configured[0]!;
    const defaultModel = defaultProvider.model ?? "(provider default)";
    const defaultSelection = {
        model: `${defaultProvider.id}/${defaultModel}`,
        reasoning: defaultProvider.reasoning
    } satisfies ModelSelectionConfig;

    // Print current assignments
    console.log("\nRole model assignments:");
    console.log("─".repeat(60));
    for (const key of ROLE_KEYS) {
        const value = settings.models?.[key];
        const display = value ? modelSelectionDisplay(value) : modelSelectionDisplay(defaultSelection);
        const marker = value ? "" : " (default)";
        console.log(`  ${ROLE_LABELS[key].padEnd(24)} ${display}${marker}`);
    }
    console.log("\nFlavor model assignments:");
    console.log("─".repeat(60));
    const customFlavorKeys = Object.keys(settings.modelFlavors ?? {}).filter((key) => !(key in BUILTIN_MODEL_FLAVORS));
    for (const key of BUILTIN_FLAVOR_KEYS) {
        const entry = settings.modelFlavors?.[key];
        const display = entry ? modelSelectionDisplay(entry) : `auto (${key} from provider catalog)`;
        const marker = entry ? "" : " (default)";
        console.log(`  ${flavorLabelBuild(key).padEnd(24)} ${display}${marker}`);
    }
    for (const key of customFlavorKeys) {
        const entry = settings.modelFlavors?.[key];
        if (!entry) {
            continue;
        }
        console.log(`  ${flavorLabelBuild(key).padEnd(24)} ${modelSelectionDisplay(entry)} (${entry.description})`);
    }

    // Show override rules
    const overrideRules = await ruleStore.findAll();
    console.log("\nOverride rules:");
    console.log("─".repeat(60));
    if (overrideRules.length === 0) {
        console.log("  (none)");
    } else {
        for (const rule of overrideRules) {
            console.log(`  ${rule.id}  ${ruleMatcherSummary(rule)}  →  ${ruleSelectionDisplay(rule)}`);
        }
    }
    console.log("");

    if (options.list) {
        return;
    }

    // Interactive: select an assignment target to configure
    const roleChoices = ROLE_KEYS.map((key) => ({
        value: `role:${key}`,
        name: ROLE_LABELS[key],
        description: settings.models?.[key] ? modelSelectionDisplay(settings.models[key]!) : "default"
    }));
    const builtinFlavorChoices = BUILTIN_FLAVOR_KEYS.map((key) => ({
        value: `flavor:${key}`,
        name: flavorLabelBuild(key),
        description: settings.modelFlavors?.[key] ? modelSelectionDisplay(settings.modelFlavors[key]!) : `auto (${key})`
    }));
    const customFlavorChoices = customFlavorKeys.map((key) => ({
        value: `flavor:${key}`,
        name: flavorLabelBuild(key),
        description: settings.modelFlavors?.[key]
            ? `${modelSelectionDisplay(settings.modelFlavors[key]!)}`
            : "Custom flavor"
    }));
    const addCustomFlavorChoice = {
        value: ADD_CUSTOM_FLAVOR_CHOICE,
        name: "Add custom flavor",
        description: "Create a new named flavor mapped to provider/model"
    };

    // Override rule management choices
    const ruleChoices: Array<{ value: string; name: string; description: string }> = [];
    ruleChoices.push({
        value: ADD_OVERRIDE_RULE_CHOICE,
        name: "Add override rule",
        description: "Create a dynamic model override rule"
    });
    if (overrideRules.length > 0) {
        ruleChoices.push(
            {
                value: EDIT_OVERRIDE_RULE_CHOICE,
                name: "Edit override rule",
                description: "Update an existing override rule"
            },
            {
                value: DELETE_OVERRIDE_RULE_CHOICE,
                name: "Delete override rule",
                description: "Remove an existing override rule"
            }
        );
    }

    const selectedTarget = await promptSelect({
        message: "Select assignment to configure",
        choices: [
            ...roleChoices,
            ...builtinFlavorChoices,
            ...customFlavorChoices,
            addCustomFlavorChoice,
            ...ruleChoices
        ]
    });

    if (!selectedTarget) {
        console.log("Cancelled.");
        return;
    }

    if (selectedTarget === ADD_CUSTOM_FLAVOR_CHOICE) {
        await customFlavorAdd(settingsPath, settings, configured);
        return;
    }

    if (selectedTarget === ADD_OVERRIDE_RULE_CHOICE) {
        await overrideRuleAdd(ruleStore);
        return;
    }
    if (selectedTarget === EDIT_OVERRIDE_RULE_CHOICE) {
        await overrideRuleEdit(ruleStore, overrideRules);
        return;
    }
    if (selectedTarget === DELETE_OVERRIDE_RULE_CHOICE) {
        await overrideRuleDelete(ruleStore, overrideRules);
        return;
    }

    const target = assignmentTargetParse(selectedTarget);
    if (!target) {
        console.log("Invalid assignment target.");
        return;
    }
    const targetLabel = assignmentTargetLabel(target);

    // Build model choices from provider catalogs
    const providerModels = providerModelChoicesBuild(configured);
    if (providerModels.length === 0) {
        console.log("No provider catalog models available.");
        return;
    }
    const clearChoice = {
        value: "__clear__",
        name: "Clear (use default)",
        description: target.type === "role" ? "Remove role override" : "Remove built-in flavor override"
    };

    const choices =
        target.type === "flavor" && !builtinFlavorParse(target.key) ? providerModels : [clearChoice, ...providerModels];

    const selectedModel = await promptSelect({
        message: `Select model for ${targetLabel}`,
        choices
    });

    if (!selectedModel) {
        console.log("Cancelled.");
        return;
    }

    // Handle clear
    if (selectedModel === "__clear__") {
        await updateSettingsFile(settingsPath, (current) => assignmentTargetClear(current, target));
        const reloaded = await engineReloadRequest(settingsPath);
        console.log(
            reloaded ? `Cleared ${targetLabel} override (engine reloaded).` : `Cleared ${targetLabel} override.`
        );
        return;
    }

    // Validate format
    const slashIndex = selectedModel.indexOf("/");
    if (slashIndex <= 0 || slashIndex === selectedModel.length - 1) {
        console.log('Invalid format. Expected "provider/model".');
        return;
    }

    const providerId = selectedModel.slice(0, slashIndex);
    const modelName = selectedModel.slice(slashIndex + 1);
    const existingSelection =
        target.type === "role" ? settings.models?.[target.key] : (settings.modelFlavors?.[target.key] ?? undefined);
    const selectedReasoning = await reasoningLevelSelect(targetLabel, existingSelection?.reasoning);
    if (selectedReasoning === null) {
        console.log("Cancelled.");
        return;
    }

    // Validate the model with a micro inference call
    const providerSettings = configured.find((p) => p.id === providerId);
    if (!providerSettings) {
        console.log(`Provider "${providerId}" is not configured. Available: ${configured.map((p) => p.id).join(", ")}`);
        return;
    }

    console.log(`Validating ${selectedModel}...`);
    const validation = await validateModel(providerSettings, modelName, settingsPath, selectedReasoning);
    if (!validation.ok) {
        console.log(`Validation failed: ${validation.message}`);
        return;
    }
    console.log(`  OK: Model responds (${validation.modelId})`);

    // Save
    await updateSettingsFile(settingsPath, (current) =>
        assignmentTargetSet(current, target, { model: selectedModel, reasoning: selectedReasoning ?? undefined })
    );

    const reloaded = await engineReloadRequest(settingsPath);
    console.log(
        reloaded
            ? `Set ${targetLabel} model to ${selectedModel} (engine reloaded).`
            : `Set ${targetLabel} model to ${selectedModel}.`
    );
}

export function assignmentTargetParse(value: string): ModelAssignmentTarget | null {
    if (value.startsWith("role:")) {
        const key = value.slice("role:".length) as ModelRoleKey;
        return ROLE_KEYS.includes(key) ? { type: "role", key } : null;
    }
    if (value.startsWith("flavor:")) {
        const key = value.slice("flavor:".length);
        return key.trim() ? { type: "flavor", key } : null;
    }
    return null;
}

function assignmentTargetLabel(target: ModelAssignmentTarget): string {
    return target.type === "role" ? ROLE_LABELS[target.key] : flavorLabelBuild(target.key);
}

export function assignmentTargetClear(settings: SettingsConfig, target: ModelAssignmentTarget): SettingsConfig {
    if (target.type === "role") {
        const models = { ...settings.models };
        delete models[target.key];
        const hasKeys = Object.keys(models).length > 0;
        return { ...settings, models: hasKeys ? models : undefined };
    }
    const modelFlavors = { ...(settings.modelFlavors ?? {}) };
    delete modelFlavors[target.key];
    const hasKeys = Object.keys(modelFlavors).length > 0;
    return { ...settings, modelFlavors: hasKeys ? modelFlavors : undefined };
}

export function assignmentTargetSet(
    settings: SettingsConfig,
    target: ModelAssignmentTarget,
    selection: ModelSelectionConfig
): SettingsConfig {
    if (target.type === "role") {
        return {
            ...settings,
            models: {
                ...settings.models,
                [target.key]: selection
            }
        };
    }

    const existingFlavor = settings.modelFlavors?.[target.key];
    const builtinFlavor = builtinFlavorParse(target.key);
    const description =
        existingFlavor?.description ?? (builtinFlavor ? BUILTIN_MODEL_FLAVORS[builtinFlavor].description : "");
    if (!description) {
        throw new Error(`Custom flavor "${target.key}" is missing description; add it first.`);
    }

    return {
        ...settings,
        modelFlavors: {
            ...settings.modelFlavors,
            [target.key]: {
                model: selection.model,
                description,
                reasoning: selection.reasoning
            }
        }
    };
}

async function customFlavorAdd(
    settingsPath: string,
    settings: SettingsConfig,
    configuredProviders: ProviderSettings[]
): Promise<void> {
    const flavorName = await promptInput({
        message: "Flavor name",
        placeholder: "coding"
    });
    if (!flavorName) {
        console.log("Cancelled.");
        return;
    }

    const normalizedName = flavorName.trim();
    const flavorNameError = customFlavorNameValidate(normalizedName, settings.modelFlavors);
    if (flavorNameError) {
        console.log(`Invalid flavor name: ${flavorNameError}`);
        return;
    }

    const providerModels = providerModelChoicesBuild(configuredProviders);
    if (providerModels.length === 0) {
        console.log("No provider catalog models available.");
        return;
    }
    const selectedModel = await promptSelect({
        message: `Select model for ${flavorLabelBuild(normalizedName)}`,
        choices: providerModels
    });
    if (!selectedModel) {
        console.log("Cancelled.");
        return;
    }

    const description = await promptInput({
        message: "Flavor description",
        placeholder: "When to use this flavor"
    });
    const normalizedDescription = description?.trim() ?? "";
    if (!normalizedDescription) {
        console.log("Flavor description is required.");
        return;
    }

    const slashIndex = selectedModel.indexOf("/");
    if (slashIndex <= 0 || slashIndex === selectedModel.length - 1) {
        console.log('Invalid format. Expected "provider/model".');
        return;
    }
    const providerId = selectedModel.slice(0, slashIndex);
    const modelName = selectedModel.slice(slashIndex + 1);
    const providerSettings = configuredProviders.find((provider) => provider.id === providerId);
    if (!providerSettings) {
        console.log(`Provider "${providerId}" is not configured.`);
        return;
    }

    const selectedReasoning = await reasoningLevelSelect(flavorLabelBuild(normalizedName));
    if (selectedReasoning === null) {
        console.log("Cancelled.");
        return;
    }

    console.log(`Validating ${selectedModel}...`);
    const validation = await validateModel(providerSettings, modelName, settingsPath, selectedReasoning);
    if (!validation.ok) {
        console.log(`Validation failed: ${validation.message}`);
        return;
    }
    console.log(`  OK: Model responds (${validation.modelId})`);

    await updateSettingsFile(settingsPath, (current) => ({
        ...current,
        modelFlavors: {
            ...(current.modelFlavors ?? {}),
            [normalizedName]: {
                model: selectedModel,
                description: normalizedDescription,
                reasoning: selectedReasoning ?? undefined
            }
        }
    }));

    const reloaded = await engineReloadRequest(settingsPath);
    console.log(
        reloaded
            ? `Added custom flavor "${normalizedName}" as ${selectedModel} (engine reloaded).`
            : `Added custom flavor "${normalizedName}" as ${selectedModel}.`
    );
}

export function customFlavorNameValidate(name: string, modelFlavors: SettingsConfig["modelFlavors"]): string | null {
    if (!name) {
        return "name is required";
    }
    if (/\s/.test(name)) {
        return "spaces are not allowed";
    }
    if (builtinFlavorParse(name)) {
        return "name cannot be a built-in flavor";
    }
    if (modelFlavors && Object.keys(modelFlavors).some((key) => key.toLowerCase() === name.toLowerCase())) {
        return "flavor already exists";
    }
    return null;
}

function providerModelChoicesBuild(configuredProviders: ProviderSettings[]): Array<{
    value: string;
    name: string;
    description: string;
}> {
    const providerModels: Array<{ value: string; name: string; description: string }> = [];
    for (const provider of configuredProviders) {
        const definition = getProviderDefinition(provider.id);
        const models = definition?.models ?? [];
        for (const model of models) {
            if (model.deprecated) {
                continue;
            }
            providerModels.push({
                value: `${provider.id}/${model.id}`,
                name: `${definition?.name ?? provider.id} — ${model.name}`,
                description: `${provider.id}/${model.id}`
            });
        }
    }
    return providerModels;
}

function flavorLabelBuild(flavorKey: string): string {
    return `Flavor: ${flavorKey}`;
}

function modelSelectionDisplay(selection: Pick<ModelSelectionConfig, "model" | "reasoning">): string {
    return selection.reasoning ? `${selection.model} [reasoning=${selection.reasoning}]` : selection.model;
}

async function reasoningLevelSelect(
    targetLabel: string,
    currentReasoning?: ThinkingLevel
): Promise<ThinkingLevel | undefined | null> {
    const choices = [
        {
            value: AUTO_REASONING_CHOICE,
            name: currentReasoning ? "Auto (provider/model default)" : "Auto (provider/model default) (current)",
            description: "Do not force a reasoning level"
        },
        ...REASONING_LEVELS.map((level) => ({
            value: level,
            name: level === currentReasoning ? `${reasoningLabelBuild(level)} (current)` : reasoningLabelBuild(level),
            description: `Force ${level} reasoning`
        }))
    ];

    const selected = await promptSelect({
        message: `Select reasoning level for ${targetLabel}`,
        choices
    });
    if (!selected) {
        return null;
    }
    return selected === AUTO_REASONING_CHOICE ? undefined : (selected as ThinkingLevel);
}

function reasoningLabelBuild(level: ThinkingLevel): string {
    switch (level) {
        case "minimal":
            return "Minimal";
        case "low":
            return "Low";
        case "medium":
            return "Medium";
        case "high":
            return "High";
        case "xhigh":
            return "Extra High";
    }
}

function builtinFlavorParse(flavorKey: string): BuiltinModelFlavor | null {
    const normalized = flavorKey.trim().toLowerCase();
    return normalized in BUILTIN_MODEL_FLAVORS ? (normalized as BuiltinModelFlavor) : null;
}

// --- Override rule store (IPC when engine running, direct DB otherwise) ---

type RuleRecord = ModelRoleRuleDbRecord;

type RuleStore = {
    findAll(): Promise<RuleRecord[]>;
    insert(input: ModelRoleRuleCreateInput): Promise<RuleRecord>;
    update(id: string, input: ModelRoleRuleUpdateInput): Promise<RuleRecord | null>;
    delete(id: string): Promise<boolean>;
};

/**
 * Tries IPC first (engine running). Falls back to direct DB access.
 */
async function ruleStoreOpen(config: {
    socketPath: string;
    db: { path: string; url: string | null };
}): Promise<RuleStore> {
    try {
        await listModelRoleRules(config.socketPath);
        // IPC works — use it
        return {
            findAll: async () => {
                const res = await listModelRoleRules(config.socketPath);
                return res.rules.map(ipcRuleToRecord);
            },
            insert: async (input) => {
                const rule = await setModelRoleRule(
                    {
                        role: input.role ?? null,
                        kind: input.kind ?? null,
                        userId: input.userId ?? null,
                        agentId: input.agentId ?? null,
                        model: input.model,
                        reasoning: input.reasoning ?? null
                    },
                    config.socketPath
                );
                return ipcRuleToRecord(rule);
            },
            update: async (id, input) => {
                const rule = await setModelRoleRule(
                    {
                        id,
                        role: input.role ?? null,
                        kind: input.kind ?? null,
                        userId: input.userId ?? null,
                        agentId: input.agentId ?? null,
                        model: input.model ?? "",
                        reasoning: input.reasoning ?? null
                    },
                    config.socketPath
                );
                return ipcRuleToRecord(rule);
            },
            delete: async (id) => {
                return deleteModelRoleRule(id, config.socketPath);
            }
        };
    } catch {
        // Engine not running — open DB directly
        const storage = await storageOpen(config.db.path, { url: config.db.url, autoMigrate: false });
        return storage.modelRoleRules;
    }
}

function ipcRuleToRecord(rule: ModelRoleRuleResponse): RuleRecord {
    return {
        id: rule.id,
        role: rule.role,
        kind: rule.kind,
        userId: rule.userId,
        agentId: rule.agentId,
        model: rule.model,
        reasoning: rule.reasoning,
        createdAt: rule.createdAt,
        updatedAt: rule.updatedAt
    };
}

// --- Override rule helpers ---

function ruleMatcherSummary(rule: RuleRecord): string {
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

async function overrideRuleAdd(ruleStore: RuleStore): Promise<void> {
    const model = await promptInput({ message: "Model (provider/model)", placeholder: "anthropic/claude-sonnet-4-6" });
    if (!model?.trim()) {
        console.log("Cancelled.");
        return;
    }

    const reasoning = await reasoningLevelSelect("override rule");
    if (reasoning === null) {
        console.log("Cancelled.");
        return;
    }

    const role = await promptSelect({ message: "Match role?", choices: RULE_ROLE_CHOICES });
    if (role === null) {
        console.log("Cancelled.");
        return;
    }

    const kind = await promptSelect({ message: "Match kind?", choices: RULE_KIND_CHOICES });
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

    const rule = await ruleStore.insert({
        role: role === "__none__" ? null : role,
        kind: kind === "__none__" ? null : kind,
        userId: userId.trim() || null,
        agentId: agentId.trim() || null,
        model: model.trim(),
        reasoning: reasoning ?? null
    });

    console.log("\nRule created:");
    console.log(`  ${rule.id}  ${ruleMatcherSummary(rule)}  →  ${ruleSelectionDisplay(rule)}`);
}

async function overrideRuleEdit(ruleStore: RuleStore, rules: RuleRecord[]): Promise<void> {
    const choices = rules.map((rule) => ({
        value: rule.id,
        name: `${ruleMatcherSummary(rule)}  →  ${ruleSelectionDisplay(rule)}`,
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

    console.log(`\nEditing: ${existing.id}  ${ruleMatcherSummary(existing)}  →  ${ruleSelectionDisplay(existing)}\n`);

    const model = await promptInput({
        message: "Model (provider/model)",
        default: existing.model,
        placeholder: existing.model
    });
    if (model === null) {
        console.log("Cancelled.");
        return;
    }

    const reasoning = await reasoningLevelSelect("override rule", existing.reasoning ?? undefined);
    if (reasoning === null) {
        console.log("Cancelled.");
        return;
    }

    const roleDefault = existing.role ?? "__none__";
    const role = await promptSelect({
        message: "Match role?",
        choices: RULE_ROLE_CHOICES.map((c) => ({
            ...c,
            name: c.value === roleDefault ? `${c.name} (current)` : c.name
        }))
    });
    if (role === null) {
        console.log("Cancelled.");
        return;
    }

    const kindDefault = existing.kind ?? "__none__";
    const kind = await promptSelect({
        message: "Match kind?",
        choices: RULE_KIND_CHOICES.map((c) => ({
            ...c,
            name: c.value === kindDefault ? `${c.name} (current)` : c.name
        }))
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

    const rule = await ruleStore.update(selectedId, {
        role: role === "__none__" ? null : role,
        kind: kind === "__none__" ? null : kind,
        userId: userId.trim() || null,
        agentId: agentId.trim() || null,
        model: model.trim() || existing.model,
        reasoning: reasoning ?? null
    });

    if (rule) {
        console.log("\nRule updated:");
        console.log(`  ${rule.id}  ${ruleMatcherSummary(rule)}  →  ${ruleSelectionDisplay(rule)}`);
    } else {
        console.log("Rule not found.");
    }
}

async function overrideRuleDelete(ruleStore: RuleStore, rules: RuleRecord[]): Promise<void> {
    const choices = rules.map((rule) => ({
        value: rule.id,
        name: `${ruleMatcherSummary(rule)}  →  ${ruleSelectionDisplay(rule)}`,
        description: rule.id
    }));

    const selectedId = await promptSelect({ message: "Select rule to delete", choices });
    if (!selectedId) {
        console.log("Cancelled.");
        return;
    }

    const existing = rules.find((r) => r.id === selectedId);
    if (existing) {
        console.log(`  ${existing.id}  ${ruleMatcherSummary(existing)}  →  ${ruleSelectionDisplay(existing)}`);
    }

    const confirmed = await promptConfirm({ message: "Delete this rule?", default: false });
    if (!confirmed) {
        console.log("Cancelled.");
        return;
    }

    const deleted = await ruleStore.delete(selectedId);
    console.log(deleted ? `Rule ${selectedId} deleted.` : `Rule ${selectedId} not found.`);
}

function ruleSelectionDisplay(rule: Pick<RuleRecord, "model" | "reasoning">): string {
    return modelSelectionDisplay({ model: rule.model, reasoning: rule.reasoning ?? undefined });
}

async function validateModel(
    providerSettings: ProviderSettings,
    model: string,
    settingsPath: string,
    reasoning?: ThinkingLevel
): Promise<{ ok: true; modelId: string } | { ok: false; message: string }> {
    const definition = getProviderDefinition(providerSettings.id);
    if (!definition) {
        return { ok: false, message: "Unknown provider definition." };
    }
    if (!definition.capabilities.inference) {
        return { ok: false, message: "Provider has no inference capability." };
    }

    const config = await configLoad(settingsPath);
    const auth = new AuthStore(config);
    const fileStore = new FileFolder(path.join(config.dataDir, "validate"));
    const inferenceRegistry = new InferenceRegistry();
    const imageRegistry = new ImageGenerationRegistry();
    const logger = getLogger(`models.${providerSettings.id}`);

    const instance = await Promise.resolve(
        definition.create({
            settings: providerSettings,
            auth,
            fileStore,
            inferenceRegistry,
            imageRegistry,
            logger
        })
    );

    await instance.load?.();
    try {
        const registered = inferenceRegistry.get(providerSettings.id);
        if (!registered) {
            return { ok: false, message: "Provider did not register inference." };
        }

        const overrideSettings: ProviderSettings = { ...providerSettings, model, reasoning };
        const router = new InferenceRouter({
            registry: inferenceRegistry,
            auth,
            config: new ConfigModule(
                configResolve(
                    { engine: { dataDir: path.join(process.cwd(), ".daycare-models") }, providers: [overrideSettings] },
                    path.join(process.cwd(), ".daycare-models-settings.json")
                )
            )
        });

        const context: Context = {
            messages: [{ role: "user", content: [{ type: "text", text: "Say OK." }], timestamp: Date.now() }],
            tools: []
        };

        const result = await router.complete(context, validationSessionIdCreate("model-validation"));

        if (result.message.stopReason === "error") {
            return { ok: false, message: "Model returned an error." };
        }

        return { ok: true, modelId: result.modelId };
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { ok: false, message };
    } finally {
        try {
            await instance.unload?.();
        } catch {}
    }
}
