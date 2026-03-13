export type DiffLine = {
    type: "added" | "removed" | "unchanged";
    text: string;
};

/**
 * Computes a simple line-based diff between two strings.
 * Uses a basic LCS (longest common subsequence) approach.
 *
 * Expects: both inputs are strings (empty string is valid).
 */
export function documentDiffCompute(oldText: string, newText: string): DiffLine[] {
    const oldLines = oldText === "" ? [] : oldText.split("\n");
    const newLines = newText === "" ? [] : newText.split("\n");

    const m = oldLines.length;
    const n = newLines.length;

    // Build LCS table
    const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            if (oldLines[i - 1] === newLines[j - 1]) {
                dp[i][j] = dp[i - 1][j - 1] + 1;
            } else {
                dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
            }
        }
    }

    // Backtrack to produce diff
    const result: DiffLine[] = [];
    let i = m;
    let j = n;
    while (i > 0 || j > 0) {
        if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
            result.push({ type: "unchanged", text: oldLines[i - 1] });
            i--;
            j--;
        } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
            result.push({ type: "added", text: newLines[j - 1] });
            j--;
        } else {
            result.push({ type: "removed", text: oldLines[i - 1] });
            i--;
        }
    }

    return result.reverse();
}
