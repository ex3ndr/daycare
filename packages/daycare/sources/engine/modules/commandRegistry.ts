import { getLogger } from "../../log.js";
import type { PluginCommandDefinition, SlashCommandEntry } from "./connectors/types.js";

type RegisteredCommand = PluginCommandDefinition & { pluginId: string };
type CommandChangeListener = (commands: SlashCommandEntry[]) => void;

export class CommandRegistry {
    private readonly commands = new Map<string, RegisteredCommand>();
    private readonly listeners = new Set<CommandChangeListener>();
    private readonly logger = getLogger("commands.registry");

    register(pluginId: string, definition: PluginCommandDefinition): void {
        this.logger.debug(`register: Registering command pluginId=${pluginId} command=${definition.command}`);
        this.commands.set(definition.command, {
            ...definition,
            pluginId
        });
        this.emitChange();
    }

    unregister(name: string): void {
        this.logger.debug(`unregister: Unregistering command command=${name}`);
        if (!this.commands.delete(name)) {
            return;
        }
        this.emitChange();
    }

    unregisterByPlugin(pluginId: string): void {
        this.logger.debug(`unregister: Unregistering commands by plugin pluginId=${pluginId}`);
        let removed = 0;
        for (const [name, entry] of this.commands.entries()) {
            if (entry.pluginId !== pluginId) {
                continue;
            }
            this.commands.delete(name);
            removed += 1;
        }
        if (removed > 0) {
            this.emitChange();
        }
    }

    get(name: string): PluginCommandDefinition | null {
        const entry = this.commands.get(name);
        if (!entry) {
            return null;
        }
        return {
            command: entry.command,
            description: entry.description,
            handler: entry.handler
        };
    }

    list(): SlashCommandEntry[] {
        return Array.from(this.commands.values()).map((entry) => ({
            command: entry.command,
            description: entry.description
        }));
    }

    onChange(listener: CommandChangeListener): () => void {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    }

    private emitChange(): void {
        const commands = this.list();
        for (const listener of this.listeners) {
            listener(commands);
        }
    }
}
