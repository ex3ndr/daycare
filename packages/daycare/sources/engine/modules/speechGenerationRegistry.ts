import { getLogger } from "../../log.js";
import type { SpeechGenerationProvider } from "./speech/types.js";

type RegisteredSpeechProvider = SpeechGenerationProvider & { pluginId: string };

export class SpeechGenerationRegistry {
    private providers = new Map<string, RegisteredSpeechProvider>();
    private logger = getLogger("speech.registry");

    register(pluginId: string, provider: SpeechGenerationProvider): void {
        this.logger.debug(
            `register: Registering speech provider pluginId=${pluginId} providerId=${provider.id} label=${provider.label}`
        );
        this.providers.set(provider.id, { ...provider, pluginId });
        this.logger.debug(`register: Speech provider registered totalProviders=${this.providers.size}`);
    }

    unregister(id: string): void {
        this.logger.debug(`unregister: Unregistering speech provider providerId=${id}`);
        this.providers.delete(id);
    }

    unregisterByPlugin(pluginId: string): void {
        this.logger.debug(`unregister: Unregistering speech providers by plugin pluginId=${pluginId}`);
        let count = 0;
        for (const [id, entry] of this.providers.entries()) {
            if (entry.pluginId === pluginId) {
                this.providers.delete(id);
                count += 1;
            }
        }
        this.logger.debug(
            `unregister: Speech providers unregistered by plugin pluginId=${pluginId} unregisteredCount=${count}`
        );
    }

    get(id: string): SpeechGenerationProvider | null {
        return this.providers.get(id) ?? null;
    }

    list(): SpeechGenerationProvider[] {
        return Array.from(this.providers.values());
    }
}
