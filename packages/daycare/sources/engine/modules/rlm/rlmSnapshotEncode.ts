/**
 * Encodes a Monty snapshot binary dump as base64 for checkpoint handoff.
 * Expects: snapshotDump is the output from `MontySnapshot.dump()`.
 */
export function rlmSnapshotEncode(snapshotDump: Uint8Array): string {
    return Buffer.from(snapshotDump).toString("base64");
}
