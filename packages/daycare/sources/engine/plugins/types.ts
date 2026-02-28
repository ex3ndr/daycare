import type { Logger } from "pino";
import type { ZodType } from "zod";
import type { ExposeProviderRegistrationApi } from "@/types";
import type { AuthStore } from "../../auth/store.js";
import type { PluginInstanceSettings, SettingsConfig } from "../../settings.js";
import type { Context } from "../agents/context.js";
import type { AgentDescriptor } from "../agents/ops/agentDescriptorTypes.js";
import type { FileFolder } from "../files/fileFolder.js";
import type { EngineEventBus } from "../ipc/events.js";
import type { Processes } from "../processes/processes.js";
import type { PluginEventInput } from "./events.js";
import type { PluginInference } from "./inference.js";
import type { PluginRegistrar } from "./registry.js";

export type PluginApi<TSettings = unknown> = {
    instance: PluginInstanceSettings;
    settings: TSettings;
    engineSettings: SettingsConfig;
    logger: Logger;
    auth: AuthStore;
    dataDir: string;
    tmpDir: string;
    usersDir: string;
    registrar: PluginRegistrar;
    exposes: ExposeProviderRegistrationApi;
    fileStore: FileFolder;
    inference: PluginInference;
    processes: Processes;
    mode: "runtime" | "validate";
    engineEvents?: EngineEventBus;
    webhooks: {
        trigger: (webhookId: string, data?: unknown) => Promise<void>;
    };
    events: {
        emit: (event: PluginEventInput) => void;
    };
};

export type PluginSystemPromptContext = {
    ctx: Context;
    descriptor?: AgentDescriptor;
    userDownloadsDir?: string;
};

export type PluginSystemPromptResult = {
    text: string;
    images?: string[];
};

export type PluginInstance = {
    load?: () => Promise<void>;
    unload?: () => Promise<void>;
    preStart?: () => Promise<void>;
    postStart?: () => Promise<void>;
    systemPrompt?:
        | ((
              context: PluginSystemPromptContext
          ) => Promise<string | PluginSystemPromptResult | null> | string | PluginSystemPromptResult | null)
        | string
        | null;
};

export type PromptChoice<TValue extends string> = {
    value: TValue;
    name: string;
    description?: string;
};

export type PromptSelectConfig<TValue extends string> = {
    message: string;
    choices: Array<PromptChoice<TValue>>;
};

export type PromptInputConfig = {
    message: string;
    default?: string;
    placeholder?: string;
};

export type PromptConfirmConfig = {
    message: string;
    default?: boolean;
};

export type PluginPrompt = {
    input: (config: PromptInputConfig) => Promise<string | null>;
    confirm: (config: PromptConfirmConfig) => Promise<boolean | null>;
    select: <TValue extends string>(config: PromptSelectConfig<TValue>) => Promise<TValue | null>;
};

export type PluginOnboardingApi = {
    instanceId: string;
    pluginId: string;
    dataDir: string;
    auth: AuthStore;
    prompt: PluginPrompt;
    note: (message: string, title?: string) => void;
};

export type PluginOnboardingResult = {
    settings?: Record<string, unknown>;
};

export type PluginModule<TSettings = unknown> = {
    settingsSchema: ZodType<TSettings>;
    create: (api: PluginApi<TSettings>) => PluginInstance | Promise<PluginInstance>;
    onboarding?: (api: PluginOnboardingApi) => Promise<PluginOnboardingResult | null>;
};

export function definePlugin<TSettings>(module: PluginModule<TSettings>): PluginModule<TSettings> {
    return module;
}
