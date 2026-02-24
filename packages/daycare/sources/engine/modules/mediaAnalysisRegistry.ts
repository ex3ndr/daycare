import { getLogger } from "../../log.js";
import type { MediaAnalysisProvider, MediaType } from "./media-analysis/types.js";

type RegisteredMediaProvider = MediaAnalysisProvider & { pluginId: string };

export class MediaAnalysisRegistry {
    private providers = new Map<string, RegisteredMediaProvider>();
    private logger = getLogger("media.registry");

    register(pluginId: string, provider: MediaAnalysisProvider): void {
        this.logger.debug(
            `register: Registering media provider pluginId=${pluginId} providerId=${provider.id} label=${provider.label}`
        );
        this.providers.set(provider.id, { ...provider, pluginId });
        this.logger.debug(`register: Media provider registered totalProviders=${this.providers.size}`);
    }

    unregister(id: string): void {
        this.logger.debug(`unregister: Unregistering media provider providerId=${id}`);
        this.providers.delete(id);
    }

    unregisterByPlugin(pluginId: string): void {
        this.logger.debug(`unregister: Unregistering media providers by plugin pluginId=${pluginId}`);
        let count = 0;
        for (const [id, entry] of this.providers.entries()) {
            if (entry.pluginId === pluginId) {
                this.providers.delete(id);
                count += 1;
            }
        }
        this.logger.debug(
            `unregister: Media providers unregistered by plugin pluginId=${pluginId} unregisteredCount=${count}`
        );
    }

    get(id: string): MediaAnalysisProvider | null {
        return this.providers.get(id) ?? null;
    }

    list(): MediaAnalysisProvider[] {
        return Array.from(this.providers.values());
    }

    findByMediaType(mediaType: MediaType): MediaAnalysisProvider[] {
        return this.list().filter((provider) => provider.supportedTypes.includes(mediaType));
    }
}
