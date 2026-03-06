import { loadMonty } from "react-native-monty";

let montyLoadPromise: Promise<void> | null = null;

/**
 * Loads the Monty runtime once and reuses the same promise for later callers.
 * Expects: callers await the returned promise before constructing Monty programs.
 */
export function montyEnsureLoaded(): Promise<void> {
    if (!montyLoadPromise) {
        montyLoadPromise = loadMonty();
    }
    return montyLoadPromise;
}
