import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { storageOpenTest } from "../../storage/storageOpenTest.js";
import { contextForUser } from "../agents/context.js";
import { UserHome } from "../users/userHome.js";
import { userHomeEnsure } from "../users/userHomeEnsure.js";
import { MiniApps } from "./MiniApps.js";

const tempDirs: string[] = [];

afterEach(async () => {
    for (const dir of tempDirs.splice(0, tempDirs.length)) {
        await fs.rm(dir, { recursive: true, force: true });
    }
});

describe("MiniApps", () => {
    it("separates app versions from code versions", async () => {
        const storage = await storageOpenTest();
        const usersDir = await fs.mkdtemp(path.join(os.tmpdir(), "daycare-mini-apps-"));
        tempDirs.push(usersDir);
        try {
            const ctx = contextForUser({ userId: "workspace-1" });
            await userHomeEnsure(new UserHome(usersDir, ctx.userId));
            const miniApps = new MiniApps({
                usersDir,
                storage
            });

            const created = await miniApps.create(ctx, {
                id: "crm",
                title: "CRM",
                icon: "browser",
                html: "<!doctype html><h1>v1</h1>",
                files: [{ path: "assets/app.js", content: "console.log('v1');" }]
            });
            expect(created.version).toBe(1);
            expect(created.codeVersion).toBe(1);

            const metadataOnly = await miniApps.update(ctx, "crm", {
                title: "CRM Board"
            });
            expect(metadataOnly.version).toBe(2);
            expect(metadataOnly.codeVersion).toBe(1);
            expect(metadataOnly.title).toBe("CRM Board");

            const updated = await miniApps.update(ctx, "crm", {
                html: "<!doctype html><h1>v2</h1>",
                files: [{ path: "assets/app.js", content: "console.log('v2');" }]
            });
            expect(updated.version).toBe(3);
            expect(updated.codeVersion).toBe(2);
            expect(updated.title).toBe("CRM Board");

            const versionDir = await miniApps.versionDirectory(ctx, "crm");
            expect(versionDir).toBeTruthy();
            expect(versionDir).toContain(path.join("crm", "2"));
            await expect(fs.readFile(path.join(versionDir!, "index.html"), "utf8")).resolves.toContain("v2");
            await expect(fs.readFile(path.join(versionDir!, "assets/app.js"), "utf8")).resolves.toContain("v2");

            const metadataDir = await miniApps.versionDirectoryForUserVersion(ctx.userId, "crm", 2);
            expect(metadataDir).toBeTruthy();
            expect(metadataDir).toContain(path.join("crm", "1"));
            await expect(fs.readFile(path.join(metadataDir!, "index.html"), "utf8")).resolves.toContain("v1");

            const normalizedDir = await miniApps.versionDirectoryForUser(ctx.userId, "CRM");
            expect(normalizedDir).toBe(versionDir);
        } finally {
            await storage.connection.close();
        }
    });
});
