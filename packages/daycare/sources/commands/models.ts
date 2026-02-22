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
    DEFAULT_SETTINGS_PATH,
    listProviders,
    type ModelRoleKey,
    type ProviderSettings,
    readSettingsFile,
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

/**
 * CLI command to view and configure per-role model assignments.
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
    console.log("\nModel assignments:");
    console.log("─".repeat(60));
    for (const key of ROLE_KEYS) {
        const value = settings.models?.[key];
        const display = value ?? `${defaultProvider.id}/${defaultModel}`;
        const marker = value ? "" : " (default)";
        console.log(`  ${ROLE_LABELS[key].padEnd(24)} ${display}${marker}`);
    }
    console.log("");

    if (options.list) {
        return;
    }

    // Interactive: select a role to configure
    const roleChoices = ROLE_KEYS.map((key) => ({
        value: key,
        name: ROLE_LABELS[key],
        description: settings.models?.[key] ?? "default"
    }));

    const selectedRole = await promptSelect({
        message: "Select role to configure",
        choices: roleChoices
    });

    if (!selectedRole) {
        console.log("Cancelled.");
        return;
    }

    // Build model choices from provider catalogs
    const providerModels: Array<{ value: string; name: string; description: string }> = [];
    const clearChoice = { value: "__clear__", name: "Clear (use default)", description: "Remove role override" };

    for (const provider of configured) {
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

    const choices = [clearChoice, ...providerModels];

    const customChoice = "__custom__";
    choices.push({
        value: customChoice,
        name: "Enter custom model",
        description: "Type provider/model manually"
    });

    let selectedModel = await promptSelect({
        message: `Select model for ${ROLE_LABELS[selectedRole]}`,
        choices
    });

    if (selectedModel === null) {
        console.log("Cancelled.");
        return;
    }

    if (selectedModel === customChoice) {
        const custom = await promptInput({
            message: "Enter model (provider/model)",
            placeholder: "anthropic/claude-sonnet-4-20250514"
        });
        if (!custom) {
            console.log("Cancelled.");
            return;
        }
        selectedModel = custom;
    }

    // Handle clear
    if (selectedModel === "__clear__") {
        await updateSettingsFile(settingsPath, (current) => {
            const models = { ...current.models };
            delete models[selectedRole];
            const hasKeys = Object.keys(models).length > 0;
            return { ...current, models: hasKeys ? models : undefined };
        });
        const reloaded = await engineReloadRequest(settingsPath);
        console.log(
            reloaded
                ? `Cleared ${selectedRole} model override (engine reloaded).`
                : `Cleared ${selectedRole} model override.`
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
    await updateSettingsFile(settingsPath, (current) => ({
        ...current,
        models: {
            ...current.models,
            [selectedRole]: selectedModel
        }
    }));

    const reloaded = await engineReloadRequest(settingsPath);
    console.log(
        reloaded
            ? `Set ${ROLE_LABELS[selectedRole]} model to ${selectedModel} (engine reloaded).`
            : `Set ${ROLE_LABELS[selectedRole]} model to ${selectedModel}.`
    );
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
