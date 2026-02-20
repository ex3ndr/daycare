/**
 * Returns true when tag-based RLM mode is explicitly enabled.
 * Expects: feature flags are resolved booleans from config.
 */
export function rlmNoToolsModeIs(features: { noTools: boolean; rlm: boolean; say: boolean }): boolean {
    return features.noTools && features.rlm && features.say;
}
