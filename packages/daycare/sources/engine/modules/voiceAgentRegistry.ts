import { getLogger } from "../../log.js";
import type { VoiceAgentProvider } from "./voice/types.js";

type RegisteredVoiceAgentProvider = VoiceAgentProvider & { pluginId: string };

export class VoiceAgentRegistry {
    private providers = new Map<string, RegisteredVoiceAgentProvider>();
    private logger = getLogger("voice.registry");

    register(pluginId: string, provider: VoiceAgentProvider): void {
        this.logger.debug(
            `register: Registering voice provider pluginId=${pluginId} providerId=${provider.id} label=${provider.label}`
        );
        this.providers.set(provider.id, { ...provider, pluginId });
        this.logger.debug(`register: Voice provider registered totalProviders=${this.providers.size}`);
    }

    unregister(id: string): void {
        this.logger.debug(`unregister: Unregistering voice provider providerId=${id}`);
        this.providers.delete(id);
    }

    unregisterByPlugin(pluginId: string): void {
        this.logger.debug(`unregister: Unregistering voice providers by plugin pluginId=${pluginId}`);
        let count = 0;
        for (const [id, entry] of this.providers.entries()) {
            if (entry.pluginId === pluginId) {
                this.providers.delete(id);
                count += 1;
            }
        }
        this.logger.debug(
            `unregister: Voice providers unregistered by plugin pluginId=${pluginId} unregisteredCount=${count}`
        );
    }

    get(id: string): VoiceAgentProvider | null {
        return this.providers.get(id) ?? null;
    }

    list(): VoiceAgentProvider[] {
        return Array.from(this.providers.values());
    }
}
