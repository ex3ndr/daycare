import type { PluginInstanceSettings } from "../../settings.js";
import type { PluginDefinition } from "./catalog.js";

export type ExclusiveResolution = {
    allowed: PluginInstanceSettings[];
    exclusive: PluginInstanceSettings | null;
    skipped: PluginInstanceSettings[];
};

export function resolveExclusivePlugins(
    enabled: PluginInstanceSettings[],
    catalog: Map<string, PluginDefinition>
): ExclusiveResolution {
    const exclusive = enabled.filter((plugin) => catalog.get(plugin.pluginId)?.descriptor.exclusive === true);

    if (exclusive.length === 0) {
        return { allowed: enabled, exclusive: null, skipped: [] };
    }

    const primary = exclusive[0];
    if (!primary) {
        return { allowed: enabled, exclusive: null, skipped: [] };
    }
    if (enabled.length <= 1) {
        return { allowed: enabled, exclusive: primary, skipped: [] };
    }

    const skipped = enabled.filter((plugin) => plugin.instanceId !== primary.instanceId);
    return {
        allowed: [primary],
        exclusive: primary,
        skipped
    };
}
