import type { AuthStore } from "../auth/store.js";
import type { ConfigModule } from "../engine/config/configModule.js";
import type { FileFolder } from "../engine/files/fileFolder.js";
import type { ImageGenerationRegistry } from "../engine/modules/imageGenerationRegistry.js";
import type { InferenceRegistry } from "../engine/modules/inferenceRegistry.js";
import { getLogger } from "../log.js";
import { listProviders, type ProviderSettings } from "../settings.js";
import { valueDeepEqual } from "../utils/valueDeepEqual.js";
import { getProviderDefinition, listProviderDefinitions } from "./catalog.js";
import type { ProviderDefinition, ProviderInstance } from "./types.js";

export type ProviderManagerOptions = {
    config: ConfigModule;
    auth: AuthStore;
    fileStore: FileFolder;
    inferenceRegistry: InferenceRegistry;
    imageRegistry: ImageGenerationRegistry;
    providerDefinitionResolve?: (id: string) => ProviderDefinition | null;
};

type LoadedProvider = {
    instance: ProviderInstance;
    settings: ProviderSettings;
};

const logger = getLogger("providers.manager");

export class ProviderManager {
    private readonly config: ConfigModule;
    private auth: AuthStore;
    private fileStore: FileFolder;
    private inferenceRegistry: InferenceRegistry;
    private imageRegistry: ImageGenerationRegistry;
    private providerDefinitionResolve: (id: string) => ProviderDefinition | null;
    private loaded = new Map<string, LoadedProvider>();

    constructor(options: ProviderManagerOptions) {
        this.config = options.config;
        this.auth = options.auth;
        this.fileStore = options.fileStore;
        this.inferenceRegistry = options.inferenceRegistry;
        this.imageRegistry = options.imageRegistry;
        this.providerDefinitionResolve = options.providerDefinitionResolve ?? getProviderDefinition;
    }

    listLoaded(): string[] {
        return Array.from(this.loaded.keys());
    }

    listLoadedDetails(): Array<{ id: string; name: string }> {
        return Array.from(this.loaded.keys()).map((id) => {
            const definition = this.providerDefinitionResolve(id);
            return {
                id,
                name: definition?.name ?? id
            };
        });
    }

    async reload(): Promise<void> {
        const currentConfig = this.config.current;
        logger.debug(`start: reload() starting loadedCount=${this.loaded.size}`);
        const activeProviders = listProviders(currentConfig.settings).filter((provider) => provider.enabled !== false);
        const activeIds = activeProviders.map((p) => p.id).join(",");
        logger.debug(
            `event: Active providers from settings activeCount=${activeProviders.length} activeIds=${activeIds}`
        );

        const activeIdSet = new Set(activeProviders.map((provider) => provider.id));
        for (const [id, entry] of this.loaded.entries()) {
            if (!activeIdSet.has(id)) {
                logger.debug(`unload: Provider no longer active, unloading providerId=${id}`);
                await this.unloadProvider(id, entry.instance);
            }
        }

        for (const providerSettings of activeProviders) {
            logger.debug(
                `event: Processing provider providerId=${providerSettings.id} model=${providerSettings.model}`
            );
            const definition = this.providerDefinitionResolve(providerSettings.id);
            if (!definition) {
                logger.debug(`event: Provider definition not found providerId=${providerSettings.id}`);
                logger.warn({ provider: providerSettings.id }, "event: Unknown provider");
                continue;
            }

            const existing = this.loaded.get(providerSettings.id);
            if (existing && valueDeepEqual(existing.settings, providerSettings)) {
                logger.debug(`load: Provider already loaded with same settings providerId=${providerSettings.id}`);
                continue;
            }

            if (existing) {
                logger.debug(`reload: Provider settings changed, reloading providerId=${providerSettings.id}`);
                await this.unloadProvider(providerSettings.id, existing.instance);
            }

            logger.debug(`event: Creating provider instance providerId=${providerSettings.id}`);
            const instance = await Promise.resolve(
                definition.create({
                    settings: providerSettings,
                    auth: this.auth,
                    fileStore: this.fileStore,
                    inferenceRegistry: this.inferenceRegistry,
                    imageRegistry: this.imageRegistry,
                    logger
                })
            );
            try {
                logger.debug(`load: Calling provider.load() providerId=${providerSettings.id}`);
                await instance.load?.();
                this.loaded.set(providerSettings.id, { instance, settings: structuredClone(providerSettings) });
                logger.debug(
                    `register: Provider registered providerId=${providerSettings.id} totalLoaded=${this.loaded.size}`
                );
                logger.info({ provider: providerSettings.id }, "load: Provider loaded");
            } catch (error) {
                this.inferenceRegistry.unregisterByPlugin(providerSettings.id);
                this.imageRegistry.unregisterByPlugin(providerSettings.id);
                throw error;
            }
        }
        logger.debug(`reload: reload() complete loadedCount=${this.loaded.size}`);
    }

    static listDefinitions() {
        return listProviderDefinitions();
    }

    private async unloadProvider(providerId: string, instance: ProviderInstance): Promise<void> {
        try {
            await instance.unload?.();
        } finally {
            // Providers can forget cleanup; always remove registrations bound to provider id.
            this.inferenceRegistry.unregisterByPlugin(providerId);
            this.imageRegistry.unregisterByPlugin(providerId);
            this.loaded.delete(providerId);
            logger.info({ provider: providerId }, "unload: Provider unloaded");
        }
    }
}
