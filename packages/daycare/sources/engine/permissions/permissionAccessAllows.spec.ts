import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { permissionAccessAllows } from "./permissionAccessAllows.js";

describe("permissionAccessAllows", () => {
    const tempDirs: string[] = [];

    afterEach(async () => {
        await Promise.all(tempDirs.map((dir) => fs.rm(dir, { recursive: true, force: true })));
        tempDirs.length = 0;
    });

    it("allows network access when enabled", async () => {
        const allowed = await permissionAccessAllows(
            { workingDir: "/tmp", writeDirs: [], readDirs: [], network: true, events: false },
            { kind: "network" }
        );
        expect(allowed).toBe(true);
    });

    it("allows events access when enabled", async () => {
        const allowed = await permissionAccessAllows(
            { workingDir: "/tmp", writeDirs: [], readDirs: [], network: false, events: true },
            { kind: "events" }
        );
        expect(allowed).toBe(true);
    });

    it("allows workspace access when workspace dir is writable", async () => {
        const workspace = await fs.mkdtemp(path.join(os.tmpdir(), "perm-workspace-access-"));
        tempDirs.push(workspace);
        const allowed = await permissionAccessAllows(
            {
                workspaceDir: workspace,
                workingDir: workspace,
                writeDirs: [workspace],
                readDirs: [workspace],
                network: false,
                events: false
            },
            { kind: "workspace" }
        );
        expect(allowed).toBe(true);
    });

    it("denies workspace access for app sandbox by default", async () => {
        const workspace = await fs.mkdtemp(path.join(os.tmpdir(), "perm-workspace-app-"));
        tempDirs.push(workspace);
        const appDataDir = path.join(workspace, "apps", "my-app", "data");
        await fs.mkdir(appDataDir, { recursive: true });
        const allowed = await permissionAccessAllows(
            {
                workspaceDir: workspace,
                workingDir: appDataDir,
                writeDirs: [appDataDir],
                readDirs: [workspace],
                network: false,
                events: false
            },
            { kind: "workspace" }
        );
        expect(allowed).toBe(false);
    });

    it("allows read access within allowed directories", async () => {
        const dir = await fs.mkdtemp(path.join(os.tmpdir(), "perm-allow-"));
        tempDirs.push(dir);
        const target = path.join(dir, "file.txt");
        await fs.writeFile(target, "ok", "utf8");
        const allowed = await permissionAccessAllows(
            { workingDir: dir, writeDirs: [], readDirs: [dir], network: false, events: false },
            { kind: "read", path: target }
        );
        expect(allowed).toBe(true);
    });

    it("treats empty readDirs as unrestricted read access", async () => {
        const workspaceDir = await fs.mkdtemp(path.join(os.tmpdir(), "perm-workspace-"));
        const outsideDir = await fs.mkdtemp(path.join(os.tmpdir(), "perm-outside-"));
        tempDirs.push(workspaceDir, outsideDir);
        const outsideFile = path.join(outsideDir, "outside.txt");
        await fs.writeFile(outsideFile, "ok", "utf8");

        const allowed = await permissionAccessAllows(
            { workingDir: workspaceDir, writeDirs: [], readDirs: [], network: false, events: false },
            { kind: "read", path: outsideFile }
        );

        expect(allowed).toBe(true);
    });

    it("denies write access outside allowed directories", async () => {
        const dir = await fs.mkdtemp(path.join(os.tmpdir(), "perm-deny-"));
        tempDirs.push(dir);
        const target = path.join(dir, "elsewhere", "file.txt");
        const allowed = await permissionAccessAllows(
            { workingDir: "/tmp", writeDirs: ["/tmp"], readDirs: [], network: false, events: false },
            { kind: "write", path: target }
        );
        expect(allowed).toBe(false);
    });

    it("does not imply write access from workingDir", async () => {
        const dir = await fs.mkdtemp(path.join(os.tmpdir(), "perm-working-dir-"));
        tempDirs.push(dir);
        const target = path.join(dir, "file.txt");
        const allowed = await permissionAccessAllows(
            { workingDir: dir, writeDirs: [], readDirs: [], network: false, events: false },
            { kind: "write", path: target }
        );
        expect(allowed).toBe(false);
    });

    it("allows write access when path is explicitly in writeDirs", async () => {
        const dir = await fs.mkdtemp(path.join(os.tmpdir(), "perm-write-dir-"));
        tempDirs.push(dir);
        const target = path.join(dir, "file.txt");
        const allowed = await permissionAccessAllows(
            { workingDir: "/tmp", writeDirs: [dir], readDirs: [], network: false, events: false },
            { kind: "write", path: target }
        );
        expect(allowed).toBe(true);
    });

    it("denies writing app policy files from broad directory grants", async () => {
        const workspace = await fs.mkdtemp(path.join(os.tmpdir(), "perm-app-policy-"));
        tempDirs.push(workspace);
        const appDir = path.join(workspace, "apps", "my-app");
        await fs.mkdir(appDir, { recursive: true });
        const target = path.join(appDir, "PERMISSIONS.md");

        const allowed = await permissionAccessAllows(
            { workingDir: workspace, writeDirs: [workspace], readDirs: [], network: false, events: false },
            { kind: "write", path: target }
        );
        expect(allowed).toBe(false);
    });

    it("allows writing app policy files only with explicit file grant", async () => {
        const workspace = await fs.mkdtemp(path.join(os.tmpdir(), "perm-app-policy-explicit-"));
        tempDirs.push(workspace);
        const appDir = path.join(workspace, "apps", "my-app");
        await fs.mkdir(appDir, { recursive: true });
        const target = path.join(appDir, "APP.md");

        const allowed = await permissionAccessAllows(
            {
                workingDir: workspace,
                writeDirs: [workspace, target],
                readDirs: [],
                network: false,
                events: false
            },
            { kind: "write", path: target }
        );
        expect(allowed).toBe(true);
    });
});
