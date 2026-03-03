import { createStateStore, JSONUIProvider, Renderer, type StateStore } from "@json-render/react-native";
import * as React from "react";
import { View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { type ExperimentsTodoDb, experimentsTodoDbCreate } from "@/modules/experiments/experimentsTodoDb";
import { experimentsTodoDefinition } from "@/modules/experiments/experimentsTodoDefinition";
import {
    experimentsTodoHandlersBuild,
    experimentsTodoInitialize
} from "@/modules/experiments/experimentsTodoHandlersBuild";
import { experimentsTodoRegistry } from "@/modules/experiments/experimentsTodoRegistry";

/**
 * Experiments screen that renders a JSON-defined todo app.
 * Uses PGlite as storage and syncs rows into json-render state.
 */
export function ExperimentsView() {
    const { theme } = useUnistyles();
    const dbRef = React.useRef<ExperimentsTodoDb | null>(null);
    const stateStore = React.useRef<StateStore>(createStateStore(initialStateClone())).current;
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
        const bootstrap = async () => {
            dbRef.current = experimentsTodoDbCreate();
            await experimentsTodoInitialize({
                dbResolve: () => dbRef.current,
                stateStore
            });
        };

        void bootstrap();
    }, [stateStore]);

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.surface }]}>
            <JSONUIProvider store={stateStore} handlers={handlers} registry={experimentsTodoRegistry}>
                <Renderer spec={experimentsTodoDefinition.spec} registry={experimentsTodoRegistry} />
            </JSONUIProvider>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1
    }
});

function initialStateClone(): Record<string, unknown> {
    const initialState = experimentsTodoDefinition.initialState;
    const draft = (initialState.draft ?? {}) as Record<string, unknown>;
    const stats = (initialState.stats ?? {}) as Record<string, unknown>;
    const todos = Array.isArray(initialState.todos) ? initialState.todos : [];

    return {
        ...initialState,
        draft: { ...draft },
        stats: { ...stats },
        todos: [...todos]
    };
}
