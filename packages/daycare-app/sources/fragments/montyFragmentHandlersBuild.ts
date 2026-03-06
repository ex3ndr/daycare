type MontyFragmentActionExecutor = (actionName: string, params: Record<string, unknown>) => unknown;

/**
 * Creates action handlers that delegate to a fragment action executor.
 * Expects: executeAction handles the named action and params.
 */
export function montyFragmentHandlersBuild(
    executeAction: MontyFragmentActionExecutor
): Record<string, (params: Record<string, unknown>) => unknown> {
    const handlers = new Map<string, (params: Record<string, unknown>) => unknown>();

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

                const handler = (params: Record<string, unknown>) => executeAction(property, params ?? {});

                handlers.set(property, handler);
                return handler;
            },
            has(_target, property) {
                return typeof property === "string";
            }
        }
    );
}
