import { createStateStore, JSONUIProvider, Renderer, type StateStore } from "@json-render/react-native";
import * as React from "react";
import { View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { type ExperimentsTodoDb, experimentsTodoDbCreate } from "@/modules/experiments/experimentsTodoDb";
import { experimentsTodoHandlersBuild } from "@/modules/experiments/experimentsTodoHandlersBuild";
import { experimentsTodoSpecBuild } from "@/modules/experiments/experimentsTodoSpecBuild";
import { experimentsTodoStateBuild } from "@/modules/experiments/experimentsTodoStateBuild";

const INITIAL_STATE: Record<string, unknown> = {
    loading: true,
    ready: false,
    error: null,
    draft: {
        title: ""
    },
    todos: [],
    stats: {
        total: 0,
        completed: 0,
        open: 0
    }
};

/**
 * Experiments screen that renders a JSON-defined todo app.
 * Uses PGlite as storage and syncs rows into json-render state.
 */
export function ExperimentsView() {
    const { theme } = useUnistyles();
    const dbRef = React.useRef<ExperimentsTodoDb | null>(null);
    const stateStore = React.useRef<StateStore>(createStateStore(INITIAL_STATE)).current;
    const spec = React.useMemo(() => experimentsTodoSpecBuild(), []);
    const handlers = React.useMemo(
        () =>
            experimentsTodoHandlersBuild({
                dbResolve: () => dbRef.current,
                stateStore
            }),
        [stateStore]
    );

    // Initialization is async side-effectful (DB bootstrap + first sync), so useEffect is required here.
    React.useEffect(() => {
        let cancelled = false;

        const bootstrap = async () => {
            const db = experimentsTodoDbCreate();
            dbRef.current = db;

            stateStore.update({
                "/loading": true,
                "/ready": false,
                "/error": null
            });

            try {
                await db.init();
                const todos = await db.list();
                if (cancelled) {
                    return;
                }

                stateStore.update({
                    ...experimentsTodoStateBuild(todos),
                    "/loading": false,
                    "/ready": true,
                    "/error": null
                });
            } catch (error) {
                if (cancelled) {
                    return;
                }

                stateStore.update({
                    "/loading": false,
                    "/ready": false,
                    "/error": error instanceof Error ? error.message : "Failed to initialize experiments."
                });
            }
        };

        void bootstrap();

        return () => {
            cancelled = true;
        };
    }, [stateStore]);

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.surface }]}>
            <JSONUIProvider store={stateStore} handlers={handlers}>
                <Renderer spec={spec} />
            </JSONUIProvider>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1
    }
});
