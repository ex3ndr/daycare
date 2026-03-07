import { createStateStore, type Spec, type StateStore } from "@json-render/react-native";
import * as React from "react";
import { useAuthStore } from "@/modules/auth/authContext";
import { useWorkspacesStore } from "@/modules/workspaces/workspacesContext";
import { montyFragmentExternalFunctionsBuild } from "./montyFragmentExternalFunctionsBuild";
import { montyFragmentHandlersBuild } from "./montyFragmentHandlersBuild";
import { montyFragmentAction, montyFragmentInit } from "./montyFragmentRun";
import { montyFragmentStateApply } from "./montyFragmentStateApply";
import { montyEnsureLoaded } from "./montyLoad";

type FragmentPythonHandlers = Record<string, (params: Record<string, unknown>) => unknown>;

type FragmentPythonSpec = Spec & {
    code?: unknown;
    state?: unknown;
};

export type FragmentPythonState =
    | { status: "ready"; store: StateStore; handlers: FragmentPythonHandlers; busy: boolean }
    | { status: "error"; error: string };

/**
 * Resolves a fragment's state store and custom action handlers, including optional Python init/action code.
 * Expects: spec is a fragment spec object or null while the fragment record is unavailable.
 */
export function useFragmentPython(spec: FragmentPythonSpec | null): FragmentPythonState {
    const baseUrl = useAuthStore((state) => state.baseUrl);
    const token = useAuthStore((state) => state.token);
    const activeId = useWorkspacesStore((s) => s.activeId);
    const fallbackState = React.useMemo(() => fragmentStateNormalize(spec?.state), [spec]);
    const code = typeof spec?.code === "string" && spec.code.trim() ? spec.code : null;
    const fallbackStore = React.useMemo(() => createStateStore(fallbackState), [fallbackState]);
    const fallbackReady = React.useMemo<FragmentPythonState>(() => {
        return {
            status: "ready",
            store: fallbackStore,
            handlers: {},
            busy: Boolean(code)
        };
    }, [code, fallbackStore]);

    const [runtimeState, setRuntimeState] = React.useState<FragmentPythonState>(() => fallbackReady);

    React.useEffect(() => {
        if (!code) {
            setRuntimeState(fallbackReady);
            return;
        }

        let active = true;
        let pendingCount = 1;
        const externalFunctions = montyFragmentExternalFunctionsBuild({
            baseUrl,
            token,
            workspaceId: activeId
        });
        const setBusyState = () => {
            setRuntimeState((state) =>
                state.status === "ready" && state.store === fallbackStore
                    ? {
                          ...state,
                          busy: pendingCount > 0
                      }
                    : state
            );
        };
        const executeAction = async (actionName: string, params: Record<string, unknown>) => {
            pendingCount += 1;
            if (active) {
                setBusyState();
            }

            try {
                await montyEnsureLoaded();
                const result = await montyFragmentAction(code, actionName, params, {
                    externalFunctions,
                    state: fragmentStoreRead(fallbackStore)
                });
                if (!result.ok) {
                    console.warn(`[daycare-app] fragment-python action=${actionName} error=${result.error}`);
                    return;
                }
                if (result.stateDirty && result.state) {
                    montyFragmentStateApply(fallbackStore, result.state);
                    return;
                }
                if (isRecord(result.value)) {
                    montyFragmentStateApply(fallbackStore, result.value);
                }
            } catch (error) {
                console.warn(
                    `[daycare-app] fragment-python action=${actionName} error=${
                        error instanceof Error ? error.message : String(error)
                    }`
                );
            } finally {
                pendingCount -= 1;
                if (active) {
                    setBusyState();
                }
            }
        };
        const handlers = montyFragmentHandlersBuild(executeAction);

        setRuntimeState({
            status: "ready",
            store: fallbackStore,
            handlers,
            busy: true
        });

        void (async () => {
            try {
                await montyEnsureLoaded();
                const initResult = await montyFragmentInit(code, {
                    externalFunctions,
                    state: fragmentStoreRead(fallbackStore)
                });
                if (initResult && !initResult.ok) {
                    if (active) {
                        setRuntimeState({ status: "error", error: initResult.error });
                    }
                    return;
                }

                if (initResult?.ok && initResult.stateDirty && initResult.state) {
                    montyFragmentStateApply(fallbackStore, initResult.state);
                    return;
                }

                if (initResult?.ok && isRecord(initResult.value)) {
                    montyFragmentStateApply(fallbackStore, initResult.value);
                }
            } catch (error) {
                if (active) {
                    setRuntimeState({
                        status: "error",
                        error: error instanceof Error ? error.message : String(error)
                    });
                }
            } finally {
                pendingCount -= 1;
                if (active) {
                    setBusyState();
                }
            }
        })();

        return () => {
            active = false;
        };
    }, [activeId, baseUrl, code, fallbackReady, fallbackStore, token]);

    return runtimeState;
}

function fragmentStateNormalize(value: unknown): Record<string, unknown> {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
        return {};
    }
    return value as Record<string, unknown>;
}

function fragmentStoreRead(store: StateStore): Record<string, unknown> {
    return fragmentStateNormalize(store.getSnapshot());
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
