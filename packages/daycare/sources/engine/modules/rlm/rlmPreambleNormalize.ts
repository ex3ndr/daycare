/**
 * Normalizes runtime preamble for Monty execution.
 * Expects: removes legacy TypedDict imports if present.
 */
export function rlmPreambleNormalize(preamble: string): string {
    return (
        preamble
            .split("\n")
            // Monty runtime exposes a reduced typing module and cannot import TypedDict.
            .filter((line) => !/^from typing import .*TypedDict.*$/.test(line.trim()))
            .join("\n")
            .trim()
    );
}
