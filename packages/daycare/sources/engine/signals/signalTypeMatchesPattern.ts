/**
 * Matches a signal type against a pattern using `*` as a segment wildcard.
 * Expects: both values are non-empty strings; `:` separates segments.
 */
export function signalTypeMatchesPattern(signalType: string, pattern: string): boolean {
    const normalizedType = signalType.trim();
    const normalizedPattern = pattern.trim();
    if (!normalizedType || !normalizedPattern) {
        return false;
    }

    const typeSegments = normalizedType.split(":");
    const patternSegments = normalizedPattern.split(":");
    if (typeSegments.length !== patternSegments.length) {
        return false;
    }

    for (let i = 0; i < patternSegments.length; i += 1) {
        const patternSegment = patternSegments[i];
        const typeSegment = typeSegments[i];
        if (patternSegment === "*") {
            continue;
        }
        if (patternSegment !== typeSegment) {
            return false;
        }
    }

    return true;
}
