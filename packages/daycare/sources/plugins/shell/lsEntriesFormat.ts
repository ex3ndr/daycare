type LsFormattedEntries = {
    text: string;
    count: number;
    truncated: boolean;
};

/**
 * Sorts and formats `ls -1apL` output with entry and byte truncation safeguards.
 * Expects: stdout contains one directory entry per line.
 */
export function lsEntriesFormat(stdout: string, limit: number, maxBytes = 64 * 1024): LsFormattedEntries {
    const entries = stdout
        .split("\n")
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0 && entry !== "." && entry !== "..")
        .sort((a, b) => a.localeCompare(b, "en"));

    if (entries.length === 0) {
        return {
            text: "Directory is empty.",
            count: 0,
            truncated: false
        };
    }

    const limited = entries.slice(0, limit);
    const byLimitTruncated = entries.length > limited.length;
    const byBytes = entriesTruncateByBytes(limited, maxBytes);
    const truncated = byLimitTruncated || byBytes.truncated;
    const suffix = lsSuffixBuild(entries.length, limited.length, byBytes.count, maxBytes);
    return {
        text: suffix ? `${byBytes.text}\n\n${suffix}` : byBytes.text,
        count: entries.length,
        truncated
    };
}

function entriesTruncateByBytes(
    entries: string[],
    maxBytes: number
): { text: string; count: number; truncated: boolean } {
    const selected: string[] = [];
    let bytes = 0;

    for (const entry of entries) {
        const separatorBytes = selected.length === 0 ? 0 : 1;
        const lineBytes = Buffer.byteLength(entry, "utf8") + separatorBytes;
        if (bytes + lineBytes > maxBytes) {
            break;
        }
        selected.push(entry);
        bytes += lineBytes;
    }

    if (selected.length === 0) {
        const first = entries[0] ?? "";
        return {
            text: utf8Truncate(first, maxBytes),
            count: 0,
            truncated: true
        };
    }

    return {
        text: selected.join("\n"),
        count: selected.length,
        truncated: selected.length < entries.length
    };
}

function lsSuffixBuild(totalEntries: number, limitCount: number, byteCount: number, maxBytes: number): string {
    const limitOmitted = totalEntries - limitCount;
    const byteOmitted = limitCount - byteCount;
    if (limitOmitted <= 0 && byteOmitted <= 0) {
        return "";
    }

    if (limitOmitted > 0 && byteOmitted > 0) {
        return `[Output truncated by limit and size (${maxBytes} bytes): ${limitOmitted + byteOmitted} entries omitted.]`;
    }
    if (limitOmitted > 0) {
        return `[Output truncated by limit: ${limitOmitted} entries omitted.]`;
    }
    return `[Output truncated to ${maxBytes} bytes: ${byteOmitted} entries omitted.]`;
}

function utf8Truncate(value: string, maxBytes: number): string {
    return Buffer.from(value, "utf8").subarray(0, Math.max(0, maxBytes)).toString("utf8");
}
