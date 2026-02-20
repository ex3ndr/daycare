import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import type { SessionPermissions } from "@/types";
import { sandboxFilesystemPolicyBuild } from "./sandboxFilesystemPolicyBuild.js";

function basePermissions(): SessionPermissions {
    return {
        workingDir: path.resolve("/workspace"),
        writeDirs: [path.resolve("/workspace/tmp"), path.resolve("/workspace/tmp")],
        readDirs: [],
        network: false,
        events: false
    };
}

describe("sandboxFilesystemPolicyBuild", () => {
    it("dedupes writable paths", () => {
        const result = sandboxFilesystemPolicyBuild({
            permissions: basePermissions(),
            platform: "linux",
            homeDir: "/home/alice"
        });

        expect(result.allowWrite).toEqual([path.resolve("/workspace/tmp")]);
    });

    it("adds linux sensitive deny paths to read and write", () => {
        const result = sandboxFilesystemPolicyBuild({
            permissions: basePermissions(),
            platform: "linux",
            homeDir: "/home/alice"
        });

        expect(result.denyRead).toEqual(
            expect.arrayContaining([
                path.resolve("/home/alice/.ssh"),
                path.resolve("/home/alice/.gnupg"),
                path.resolve("/home/alice/.aws"),
                path.resolve("/etc/ssh"),
                path.resolve("/etc/ssl/private"),
                path.resolve("/root/.ssh")
            ])
        );
        expect(result.denyWrite).toEqual(result.denyRead);
    });

    it("adds macOS sensitive deny paths to read and write", () => {
        const result = sandboxFilesystemPolicyBuild({
            permissions: basePermissions(),
            platform: "darwin",
            homeDir: "/Users/alice"
        });

        expect(result.denyRead).toEqual(
            expect.arrayContaining([
                path.resolve("/Users/alice/.ssh"),
                path.resolve("/Users/alice/Library/Keychains"),
                path.resolve("/Users/alice/Library/Application Support/com.apple.TCC"),
                path.resolve("/private/etc/ssh")
            ])
        );
        expect(result.denyWrite).toEqual(result.denyRead);
    });

    it("denies workspace apps directory for non-app agents", () => {
        const workingDir = path.resolve("/workspace");
        const result = sandboxFilesystemPolicyBuild({
            permissions: {
                ...basePermissions(),
                workingDir
            },
            platform: "linux",
            homeDir: "/home/alice"
        });

        expect(result.denyRead).toContain(path.resolve("/workspace/apps"));
        expect(result.denyWrite).toContain(path.resolve("/workspace/apps"));
    });

    it("denies sibling app directories for app agents", async () => {
        const workspace = await fs.mkdtemp(path.join(os.tmpdir(), "daycare-app-policy-"));
        try {
            await fs.mkdir(path.join(workspace, "apps", "my-app", "data"), { recursive: true });
            await fs.mkdir(path.join(workspace, "apps", "other-app", "data"), { recursive: true });
            const result = sandboxFilesystemPolicyBuild({
                permissions: {
                    ...basePermissions(),
                    workingDir: path.join(workspace, "apps", "my-app", "data"),
                    writeDirs: [path.join(workspace, "apps", "my-app", "data")],
                    readDirs: [workspace]
                },
                platform: "linux",
                homeDir: "/home/alice"
            });

            expect(result.denyRead).toContain(path.join(workspace, "apps", "other-app"));
            expect(result.denyRead).not.toContain(path.join(workspace, "apps", "my-app"));
        } finally {
            await fs.rm(workspace, { recursive: true, force: true });
        }
    });
});
