import path from "node:path";

import type {
    AgentDescriptor,
    Connector,
    ConnectorMessage,
    ImageGenerationProvider,
    InferenceProvider,
    MediaAnalysisProvider,
    MessageContext,
    PluginCommandDefinition,
    ToolDefinition
} from "@/types";
import { agentDescriptorTargetResolve } from "../agents/ops/agentDescriptorTargetResolve.js";
import type { CommandRegistry } from "../modules/commandRegistry.js";
import type { ConnectorRegistry } from "../modules/connectorRegistry.js";
import type { ImageGenerationRegistry } from "../modules/imageGenerationRegistry.js";
import type { InferenceRegistry } from "../modules/inferenceRegistry.js";
import type { MediaAnalysisRegistry } from "../modules/mediaAnalysisRegistry.js";
import type { ModuleRegistry } from "../modules/moduleRegistry.js";
import type { ToolResolver } from "../modules/toolResolver.js";

type PluginRegistrations = {
    connectors: Set<string>;
    providers: Set<string>;
    tools: Set<string>;
    images: Set<string>;
    mediaAnalysis: Set<string>;
    commands: Set<string>;
    skills: Set<string>;
};

export class PluginRegistrar {
    private pluginId: string;
    private commandRegistry: CommandRegistry;
    private connectorRegistry: ConnectorRegistry;
    private inferenceRegistry: InferenceRegistry;
    private imageRegistry: ImageGenerationRegistry;
    private mediaAnalysisRegistry: MediaAnalysisRegistry;
    private toolResolver: ToolResolver;
    private registrations: PluginRegistrations;

    constructor(
        pluginId: string,
        commandRegistry: CommandRegistry,
        connectorRegistry: ConnectorRegistry,
        inferenceRegistry: InferenceRegistry,
        imageRegistry: ImageGenerationRegistry,
        mediaAnalysisRegistry: MediaAnalysisRegistry,
        toolResolver: ToolResolver
    ) {
        this.pluginId = pluginId;
        this.commandRegistry = commandRegistry;
        this.connectorRegistry = connectorRegistry;
        this.inferenceRegistry = inferenceRegistry;
        this.imageRegistry = imageRegistry;
        this.mediaAnalysisRegistry = mediaAnalysisRegistry;
        this.toolResolver = toolResolver;
        this.registrations = {
            connectors: new Set(),
            providers: new Set(),
            tools: new Set(),
            images: new Set(),
            mediaAnalysis: new Set(),
            commands: new Set(),
            skills: new Set()
        };
    }

    registerConnector(id: string, connector: Connector): void {
        this.connectorRegistry.register(id, connector);
        this.registrations.connectors.add(id);
    }

    async unregisterConnector(id: string): Promise<void> {
        await this.connectorRegistry.unregister(id, "plugin-unload");
        this.registrations.connectors.delete(id);
    }

    async sendMessage(descriptor: AgentDescriptor, context: MessageContext, message: ConnectorMessage): Promise<void> {
        const target = agentDescriptorTargetResolve(descriptor);
        if (!target) {
            return;
        }
        const connector = this.connectorRegistry.get(target.connector);
        if (!connector?.capabilities.sendText) {
            return;
        }
        await connector.sendMessage(target.targetId, {
            ...message,
            replyToMessageId: context.messageId
        });
    }

    registerInferenceProvider(provider: InferenceProvider): void {
        this.inferenceRegistry.register(this.pluginId, provider);
        this.registrations.providers.add(provider.id);
    }

    unregisterInferenceProvider(id: string): void {
        this.inferenceRegistry.unregister(id);
        this.registrations.providers.delete(id);
    }

    registerTool(definition: ToolDefinition): void {
        this.toolResolver.register(this.pluginId, definition);
        this.registrations.tools.add(definition.tool.name);
    }

    unregisterTool(name: string): void {
        this.toolResolver.unregister(name);
        this.registrations.tools.delete(name);
    }

    registerCommand(definition: PluginCommandDefinition): void {
        this.commandRegistry.register(this.pluginId, definition);
        this.registrations.commands.add(definition.command);
    }

    unregisterCommand(name: string): void {
        this.commandRegistry.unregister(name);
        this.registrations.commands.delete(name);
    }

    registerImageProvider(provider: ImageGenerationProvider): void {
        this.imageRegistry.register(this.pluginId, provider);
        this.registrations.images.add(provider.id);
    }

    unregisterImageProvider(id: string): void {
        this.imageRegistry.unregister(id);
        this.registrations.images.delete(id);
    }

    registerMediaAnalysisProvider(provider: MediaAnalysisProvider): void {
        this.mediaAnalysisRegistry.register(this.pluginId, provider);
        this.registrations.mediaAnalysis.add(provider.id);
    }

    unregisterMediaAnalysisProvider(id: string): void {
        this.mediaAnalysisRegistry.unregister(id);
        this.registrations.mediaAnalysis.delete(id);
    }

    registerSkill(skillPath: string): void {
        const resolved = path.resolve(skillPath);
        this.registrations.skills.add(resolved);
    }

    unregisterSkill(skillPath: string): void {
        const resolved = path.resolve(skillPath);
        this.registrations.skills.delete(resolved);
    }

    listSkills(): string[] {
        return Array.from(this.registrations.skills.values());
    }

    async unregisterAll(): Promise<void> {
        for (const id of this.registrations.connectors) {
            await this.connectorRegistry.unregister(id, "plugin-unload");
        }
        for (const id of this.registrations.providers) {
            this.inferenceRegistry.unregister(id);
        }
        for (const id of this.registrations.images) {
            this.imageRegistry.unregister(id);
        }
        for (const id of this.registrations.mediaAnalysis) {
            this.mediaAnalysisRegistry.unregister(id);
        }
        for (const name of this.registrations.tools) {
            this.toolResolver.unregister(name);
        }
        for (const command of this.registrations.commands) {
            this.commandRegistry.unregister(command);
        }
        this.registrations.connectors.clear();
        this.registrations.providers.clear();
        this.registrations.images.clear();
        this.registrations.mediaAnalysis.clear();
        this.registrations.tools.clear();
        this.registrations.commands.clear();
        this.registrations.skills.clear();
    }
}

export class PluginRegistry {
    private commandRegistry: CommandRegistry;
    private connectorRegistry: ConnectorRegistry;
    private inferenceRegistry: InferenceRegistry;
    private imageRegistry: ImageGenerationRegistry;
    private mediaAnalysisRegistry: MediaAnalysisRegistry;
    private toolResolver: ToolResolver;

    constructor(modules: ModuleRegistry) {
        this.commandRegistry = modules.commands;
        this.connectorRegistry = modules.connectors;
        this.inferenceRegistry = modules.inference;
        this.imageRegistry = modules.images;
        this.mediaAnalysisRegistry = modules.mediaAnalysis;
        this.toolResolver = modules.tools;
    }

    createRegistrar(pluginId: string): PluginRegistrar {
        return new PluginRegistrar(
            pluginId,
            this.commandRegistry,
            this.connectorRegistry,
            this.inferenceRegistry,
            this.imageRegistry,
            this.mediaAnalysisRegistry,
            this.toolResolver
        );
    }
}
