import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import type { Config } from "@/types";
import { AuthStore } from "./store.js";

describe("AuthStore", () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("does not re-read auth.json from disk when cached reads are enabled", async () => {
        const dir = await fs.mkdtemp(path.join(os.tmpdir(), "daycare-auth-"));
        const authPath = path.join(dir, "auth.json");
        await fs.writeFile(authPath, `${JSON.stringify({ openai: { type: "apiKey", apiKey: "first" } })}\n`);

        const readSpy = vi.spyOn(fs, "readFile");
        const store = new AuthStore({ authPath } as Config, { cacheReads: true });

        await expect(store.read()).resolves.toEqual({
            openai: { type: "apiKey", apiKey: "first" }
        });

        await fs.writeFile(authPath, `${JSON.stringify({ openai: { type: "apiKey", apiKey: "second" } })}\n`);

        await expect(store.read()).resolves.toEqual({
            openai: { type: "apiKey", apiKey: "first" }
        });
        await expect(store.getApiKey("openai")).resolves.toBe("first");
        expect(readSpy).toHaveBeenCalledTimes(1);
    });
});
