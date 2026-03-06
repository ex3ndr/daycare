import type { StateStore } from "@json-render/react-native";

/**
 * Deep-merges a fragment state patch into the current store snapshot.
 * Expects: changes is a plain object representing the desired state updates.
 */
export function montyFragmentStateApply(store: StateStore, changes: unknown): Record<string, unknown> {
    if (!isRecord(changes)) {
        throw new Error("apply() expects a dict or callable returning a dict.");
    }

    const current = fragmentStateRead(store);
    const updates = fragmentStateUpdatesBuild(current, changes);
    if (Object.keys(updates).length > 0) {
        store.update(updates);
    }
    return fragmentStateRead(store);
}

function fragmentStateRead(store: StateStore): Record<string, unknown> {
    const snapshot = store.getSnapshot();
    return isRecord(snapshot) ? snapshot : {};
}

function fragmentStateUpdatesBuild(
    current: Record<string, unknown>,
    changes: Record<string, unknown>
): Record<string, unknown> {
    const updates: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(changes)) {
        updates[`/${jsonPointerEscape(key)}`] = fragmentValueMerge(current[key], value);
    }
    return updates;
}

function fragmentValueMerge(current: unknown, change: unknown): unknown {
    if (!isRecord(current) || !isRecord(change)) {
        return change;
    }

    const merged: Record<string, unknown> = { ...current };
    for (const [key, value] of Object.entries(change)) {
        merged[key] = fragmentValueMerge(current[key], value);
    }
    return merged;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function jsonPointerEscape(segment: string): string {
    return segment.replaceAll("~", "~0").replaceAll("/", "~1");
}
