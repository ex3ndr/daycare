import { describe, expect, it, vi } from "vitest";

import type { Storage } from "../../../storage/storage.js";
import { agentPathChildAllocate } from "./agentPathChildAllocate.js";

async function delay(ms: number): Promise<void> {
    await new Promise<void>((resolve) => {
        setTimeout(resolve, ms);
    });
}

describe("agentPathChildAllocate", () => {
    it("allocates unique child paths under concurrent calls", async () => {
        const parentAgentId = "parent-agent";
        const parentPath = "/u1/agent/parent";
        let nextSubIndex = 0;

        const storage = {
            agents: {
                findById: vi.fn(async (id: string) => {
                    await delay(5);
                    if (id !== parentAgentId) {
                        return null;
                    }
                    return {
                        id: parentAgentId,
                        path: parentPath,
                        nextSubIndex
                    };
                }),
                update: vi.fn(async (id: string, data: { nextSubIndex?: number }) => {
                    await delay(5);
                    if (id !== parentAgentId) {
                        throw new Error(`Unexpected agent id: ${id}`);
                    }
                    if (typeof data.nextSubIndex === "number") {
                        nextSubIndex = data.nextSubIndex;
                    }
                })
            }
        } as unknown as Pick<Storage, "agents">;

        const allocations = await Promise.all(
            Array.from({ length: 8 }, async () =>
                agentPathChildAllocate({
                    storage,
                    parentAgentId,
                    kind: "sub"
                })
            )
        );

        const unique = [...new Set(allocations)].sort();
        expect(unique).toEqual(Array.from({ length: 8 }, (_value, index) => `${parentPath}/sub/${index}`));
        expect(nextSubIndex).toBe(8);
    });

    it("builds a synthetic path when storage facade is not provided", async () => {
        const path = await agentPathChildAllocate({
            storage: null,
            parentAgentId: "missing-parent",
            kind: "search"
        });

        expect(path).toBe("/runtime/agent/missing-parent/search/0");
    });
});
