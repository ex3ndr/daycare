type VersionedRecord = {
    version?: number;
    validFrom?: number;
    validTo?: number | null;
};

type VersionedResolved = {
    version: number;
    validFrom: number;
    validTo: number | null;
};

type VersionAdvanceChanges<TRecord extends VersionedRecord> = Partial<
    Omit<TRecord, "version" | "validFrom" | "validTo">
>;

export type VersionAdvanceOptions<TRecord extends VersionedRecord> = {
    now?: number;
    changes: VersionAdvanceChanges<TRecord>;
    findCurrent: () => Promise<TRecord | null>;
    closeCurrent: (current: TRecord, now: number) => Promise<number>;
    insertNext: (next: TRecord) => Promise<void>;
};

/**
 * Advances a temporal versioned entity by closing the current row and inserting a new current row.
 * Expects: findCurrent resolves the active row (`validTo === null`) and lock ownership is handled by caller.
 */
export async function versionAdvance<TRecord extends VersionedRecord>(
    options: VersionAdvanceOptions<TRecord>
): Promise<TRecord & VersionedResolved> {
    const current = await options.findCurrent();
    if (!current) {
        throw new Error("Current version not found.");
    }
    if (typeof current.version !== "number") {
        throw new Error("Current version is missing version number.");
    }

    const now = options.now ?? Date.now();
    const closedCount = await options.closeCurrent(current, now);
    if (closedCount !== 1) {
        throw new Error(`Current version close failed. Expected 1 row, got ${closedCount}.`);
    }

    const next = {
        ...current,
        ...options.changes,
        version: current.version + 1,
        validFrom: now,
        validTo: null as number | null
    } as TRecord & VersionedResolved;
    await options.insertNext(next);
    return next;
}
