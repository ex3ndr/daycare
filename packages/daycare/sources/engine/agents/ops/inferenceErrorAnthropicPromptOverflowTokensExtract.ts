const PROMPT_OVERFLOW_TOKENS_REGEX = /prompt is too long:\s*([\d,]+)\s+tokens\s*>\s*[\d,]+\s+maximum/i;

/**
 * Extracts the total prompt token count from Anthropic prompt-overflow errors.
 * Expects: provider error text may include `prompt is too long: N tokens > M maximum`.
 */
export function inferenceErrorAnthropicPromptOverflowTokensExtract(errorMessage?: string): number | undefined {
    if (!errorMessage) {
        return undefined;
    }

    const match = PROMPT_OVERFLOW_TOKENS_REGEX.exec(errorMessage);
    if (!match?.[1]) {
        return undefined;
    }
    const normalized = match[1].replaceAll(",", "");
    const parsed = Number.parseInt(normalized, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        return undefined;
    }
    return parsed;
}
