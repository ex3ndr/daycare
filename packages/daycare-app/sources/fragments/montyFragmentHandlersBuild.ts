import type { StateStore } from "@json-render/react-native";
import { montyFragmentAction } from "./montyFragmentRun";

/**
 * Creates action handlers that execute fragment Python and merge returned state.
 * Expects: code defines the referenced action names; store holds fragment state.
 */
export function montyFragmentHandlersBuild(
    code: string,
    store: StateStore
): Record<string, (params: Record<string, unknown>) => unknown> {
    const handlers = new Map<string, (params: Record<string, unknown>) => void>();

    return new Proxy<Record<string, (params: Record<string, unknown>) => unknown>>(
        {},
        {
            get(_target, property) {
                if (typeof property !== "string") {
                    return undefined;
                }

                const existing = handlers.get(property);
                if (existing) {
                    return existing;
                }

                const handler = (params: Record<string, unknown>) => {
                    const snapshot = store.getSnapshot();
                    const state = isRecord(snapshot) ? snapshot : {};
                    const result = montyFragmentAction(code, property, state, params ?? {});
                    if (!result.ok) {
                        console.warn(`[daycare-app] fragment-python action=${property} error=${result.error}`);
                        return;
                    }

                    const updates = Object.fromEntries(
                        Object.entries(result.value).map(([key, value]) => [`/${jsonPointerEscape(key)}`, value])
                    );
                    store.update(updates);
                };

                handlers.set(property, handler);
                return handler;
            },
            has(_target, property) {
                return typeof property === "string";
            }
        }
    );
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function jsonPointerEscape(segment: string): string {
    return segment.replaceAll("~", "~0").replaceAll("/", "~1");
}
