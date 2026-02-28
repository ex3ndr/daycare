import path from "node:path";

import type { Context } from "@mariozechner/pi-ai";

import { AuthStore } from "../auth/store.js";
import { configLoad } from "../config/configLoad.js";
import { configResolve } from "../config/configResolve.js";
import { ConfigModule } from "../engine/config/configModule.js";
import { FileFolder } from "../engine/files/fileFolder.js";
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
    type ProviderSettings,
    readSettingsFile,
    type SettingsConfig,
    updateSettingsFile
} from "../settings.js";
import { engineReloadRequest } from "./engineReloadRequest.js";
import { promptInput, promptSelect } from "./prompts.js";

export type ModelsCommandOptions = {
    settings?: string;
    list?: boolean;
};

const ROLE_LABELS: Record<ModelRoleKey, string> = {
    user: "User-facing agents",
    memory: "Memory agent",
    memorySearch: "Memory search agent",
    subagent: "Subagents",
    heartbeat: "Heartbeat agent"
};

const ROLE_KEYS: ModelRoleKey[] = ["user", "memory", "memorySearch", "subagent", "heartbeat"];
const BUILTIN_FLAVOR_KEYS: BuiltinModelFlavor[] = ["small", "normal", "large"];

const ADD_CUSTOM_FLAVOR_CHOICE = "__add_custom_flavor__";

export type ModelAssignmentTarget = { type: "role"; key: ModelRoleKey } | { type: "flavor"; key: string };

/**
 * CLI command to view and configure role model assignments and flavor mappings.
 * Validates models on the fly before saving.
 */
export async function modelsCommand(options: ModelsCommandOptions): Promise<void> {
    const settingsPath = path.resolve(options.settings ?? DEFAULT_SETTINGS_PATH);
    const settings = await readSettingsFile(settingsPath);

    const configured = listProviders(settings).filter((p) => p.enabled !== false);
    if (configured.length === 0) {
        console.log("No configured providers. Run 'daycare add' first.");
        return;
    }

    const defaultProvider = configured[0]!;
    const defaultModel = defaultProvider.model ?? "(provider default)";

    // Print current assignments
    console.log("\nRole model assignments:");
    console.log("─".repeat(60));
    for (const key of ROLE_KEYS) {
        const value = settings.models?.[key];
        const display = value ?? `${defaultProvider.id}/${defaultModel}`;
        const marker = value ? "" : " (default)";
        console.log(`  ${ROLE_LABELS[key].padEnd(24)} ${display}${marker}`);
    }
    console.log("\nFlavor model assignments:");
    console.log("─".repeat(60));
    const customFlavorKeys = Object.keys(settings.modelFlavors ?? {}).filter((key) => !(key in BUILTIN_MODEL_FLAVORS));
    for (const key of BUILTIN_FLAVOR_KEYS) {
        const value = settings.modelFlavors?.[key]?.model;
        const display = value ?? `auto (${key} from provider catalog)`;
        const marker = value ? "" : " (default)";
        console.log(`  ${flavorLabelBuild(key).padEnd(24)} ${display}${marker}`);
    }
    for (const key of customFlavorKeys) {
        const entry = settings.modelFlavors?.[key];
        if (!entry) {
            continue;
        }
        console.log(`  ${flavorLabelBuild(key).padEnd(24)} ${entry.model} (${entry.description})`);
    }
    console.log("");

    if (options.list) {
        return;
    }

    // Interactive: select an assignment target to configure
    const roleChoices = ROLE_KEYS.map((key) => ({
        value: `role:${key}`,
        name: ROLE_LABELS[key],
        description: settings.models?.[key] ?? "default"
    }));
    const builtinFlavorChoices = BUILTIN_FLAVOR_KEYS.map((key) => ({
        value: `flavor:${key}`,
        name: flavorLabelBuild(key),
        description: settings.modelFlavors?.[key]?.model ?? `auto (${key})`
    }));
    const customFlavorChoices = customFlavorKeys.map((key) => ({
        value: `flavor:${key}`,
        name: flavorLabelBuild(key),
        description: settings.modelFlavors?.[key]?.description ?? "Custom flavor"
    }));
    const addCustomFlavorChoice = {
        value: ADD_CUSTOM_FLAVOR_CHOICE,
        name: "Add custom flavor",
        description: "Create a new named flavor mapped to provider/model"
    };

    const selectedTarget = await promptSelect({
        message: "Select assignment to configure",
        choices: [...roleChoices, ...builtinFlavorChoices, ...customFlavorChoices, addCustomFlavorChoice]
    });

    if (!selectedTarget) {
        console.log("Cancelled.");
        return;
    }

    if (selectedTarget === ADD_CUSTOM_FLAVOR_CHOICE) {
        await customFlavorAdd(settingsPath, settings, configured);
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

    // Validate the model with a micro inference call
    const providerSettings = configured.find((p) => p.id === providerId);
    if (!providerSettings) {
        console.log(`Provider "${providerId}" is not configured. Available: ${configured.map((p) => p.id).join(", ")}`);
        return;
    }

    console.log(`Validating ${selectedModel}...`);
    const validation = await validateModel(providerSettings, modelName, settingsPath);
    if (!validation.ok) {
        console.log(`Validation failed: ${validation.message}`);
        return;
    }
    console.log(`  OK: Model responds (${validation.modelId})`);

    // Save
    await updateSettingsFile(settingsPath, (current) => assignmentTargetSet(current, target, selectedModel));

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
    selectedModel: string
): SettingsConfig {
    if (target.type === "role") {
        return {
            ...settings,
            models: {
                ...settings.models,
                [target.key]: selectedModel
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
                model: selectedModel,
                description
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

    console.log(`Validating ${selectedModel}...`);
    const validation = await validateModel(providerSettings, modelName, settingsPath);
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
                description: normalizedDescription
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

function builtinFlavorParse(flavorKey: string): BuiltinModelFlavor | null {
    const normalized = flavorKey.trim().toLowerCase();
    return normalized in BUILTIN_MODEL_FLAVORS ? (normalized as BuiltinModelFlavor) : null;
}

async function validateModel(
    providerSettings: ProviderSettings,
    model: string,
    settingsPath: string
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

        const overrideSettings: ProviderSettings = { ...providerSettings, model };
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

        const result = await router.complete(context, "model-validation");

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
