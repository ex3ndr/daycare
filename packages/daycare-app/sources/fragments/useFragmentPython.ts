import { createStateStore, type Spec, type StateStore } from "@json-render/react-native";
import * as React from "react";
import { montyFragmentHandlersBuild } from "./montyFragmentHandlersBuild";
import { montyFragmentInit } from "./montyFragmentRun";
import { montyEnsureLoaded } from "./montyLoad";

type FragmentPythonHandlers = Record<string, (params: Record<string, unknown>) => unknown>;

type FragmentPythonSpec = Spec & {
    code?: unknown;
    state?: unknown;
};

export type FragmentPythonState =
    | { status: "loading" }
    | { status: "ready"; store: StateStore; handlers: FragmentPythonHandlers }
    | { status: "error"; error: string };

/**
 * Resolves a fragment's state store and custom action handlers, including optional Python init/action code.
 * Expects: spec is a fragment spec object or null while the fragment record is unavailable.
 */
export function useFragmentPython(spec: FragmentPythonSpec | null): FragmentPythonState {
    const fallbackState = React.useMemo(() => fragmentStateNormalize(spec?.state), [spec]);
    const fallbackReady = React.useMemo<FragmentPythonState>(() => {
        return {
            status: "ready",
            store: createStateStore(fallbackState),
            handlers: {}
        };
    }, [fallbackState]);
    const code = typeof spec?.code === "string" && spec.code.trim() ? spec.code : null;

    const [runtimeState, setRuntimeState] = React.useState<FragmentPythonState>(() => {
        return code ? { status: "loading" } : fallbackReady;
    });

    React.useEffect(() => {
        if (!code) {
            setRuntimeState(fallbackReady);
            return;
        }

        let active = true;
        setRuntimeState({ status: "loading" });

        void (async () => {
            try {
                await montyEnsureLoaded();
                const initResult = montyFragmentInit(code);
                if (initResult && !initResult.ok) {
                    if (active) {
                        setRuntimeState({ status: "error", error: initResult.error });
                    }
                    return;
                }

                const initialState = initResult?.ok ? initResult.value : fallbackState;
                const store = createStateStore(initialState);
                const handlers = montyFragmentHandlersBuild(code, store);

                if (active) {
                    setRuntimeState({
                        status: "ready",
                        store,
                        handlers
                    });
                }
            } catch (error) {
                if (active) {
                    setRuntimeState({
                        status: "error",
                        error: error instanceof Error ? error.message : String(error)
                    });
                }
            }
        })();

        return () => {
            active = false;
        };
    }, [code, fallbackReady, fallbackState]);

    if (!code) {
        return fallbackReady;
    }

    return runtimeState;
}

function fragmentStateNormalize(value: unknown): Record<string, unknown> {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
        return {};
    }
    return value as Record<string, unknown>;
}
