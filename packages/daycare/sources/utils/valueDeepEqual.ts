/**
 * Compares two JSON-like values with stable object-key semantics.
 * Expects: values are plain data structures (objects, arrays, primitives).
 */
export function valueDeepEqual(left: unknown, right: unknown): boolean {
    if (Object.is(left, right)) {
        return true;
    }
    if (left === null || right === null) {
        return false;
    }
    if (typeof left !== "object" || typeof right !== "object") {
        return false;
    }
    if (Array.isArray(left) || Array.isArray(right)) {
        if (!Array.isArray(left) || !Array.isArray(right)) {
            return false;
        }
        if (left.length !== right.length) {
            return false;
        }
        for (let i = 0; i < left.length; i += 1) {
            if (!valueDeepEqual(left[i], right[i])) {
                return false;
            }
        }
        return true;
    }

    const leftObject = left as Record<string, unknown>;
    const rightObject = right as Record<string, unknown>;
    const leftKeys = Object.keys(leftObject).sort();
    const rightKeys = Object.keys(rightObject).sort();
    if (leftKeys.length !== rightKeys.length) {
        return false;
    }
    for (let i = 0; i < leftKeys.length; i += 1) {
        const leftKey = leftKeys[i];
        const rightKey = rightKeys[i];
        if (!leftKey || !rightKey) {
            return false;
        }
        if (leftKey !== rightKey) {
            return false;
        }
        if (!valueDeepEqual(leftObject[leftKey], rightObject[rightKey])) {
            return false;
        }
    }
    return true;
}
