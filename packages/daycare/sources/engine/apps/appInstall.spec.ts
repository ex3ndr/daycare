import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { appInstall } from "./appInstall.js";

describe("appInstall", () => {
    let workspaceDir: string;
    let sourceRoot: string;

    beforeEach(async () => {
        workspaceDir = await fs.mkdtemp(path.join(os.tmpdir(), "daycare-app-install-workspace-"));
        sourceRoot = await fs.mkdtemp(path.join(os.tmpdir(), "daycare-app-install-source-"));
    });

    afterEach(async () => {
        await fs.rm(workspaceDir, { recursive: true, force: true });
        await fs.rm(sourceRoot, { recursive: true, force: true });
    });

    it("installs a valid app and creates data directory", async () => {
        const sourceDir = path.join(sourceRoot, "github-reviewer");
        await fs.mkdir(sourceDir, { recursive: true });
        await fs.writeFile(
            path.join(sourceDir, "APP.md"),
            [
                "---",
                "name: github-reviewer",
                "title: GitHub Reviewer",
                "description: Reviews pull requests",
                "---",
                "",
                "## System Prompt",
                "",
                "You are a focused PR review assistant."
            ].join("\n")
        );
        await fs.writeFile(
            path.join(sourceDir, "PERMISSIONS.md"),
            [
                "## Source Intent",
                "",
                "Review pull requests safely.",
                "",
                "## Rules",
                "",
                "### Allow",
                "- Read files",
                "",
                "### Deny",
                "- Delete files"
            ].join("\n")
        );
        await fs.writeFile(path.join(sourceDir, "README.md"), "hello");

        const installed = await appInstall(workspaceDir, sourceDir);
        expect(installed.id).toBe("github-reviewer");
        expect(installed.path).toBe(path.join(workspaceDir, "apps", "github-reviewer"));

        const dataStat = await fs.stat(path.join(installed.path, "data"));
        expect(dataStat.isDirectory()).toBe(true);
    });

    it("throws for invalid source manifest", async () => {
        const sourceDir = path.join(sourceRoot, "broken");
        await fs.mkdir(sourceDir, { recursive: true });
        await fs.writeFile(
            path.join(sourceDir, "APP.md"),
            [
                "---",
                "name: Invalid With Spaces",
                "title: Broken",
                "description: bad id",
                "---",
                "",
                "## System Prompt",
                "",
                "You are broken."
            ].join("\n")
        );
        await fs.writeFile(
            path.join(sourceDir, "PERMISSIONS.md"),
            [
                "## Source Intent",
                "",
                "Broken app intent.",
                "",
                "## Rules",
                "",
                "### Allow",
                "- Read files",
                "",
                "### Deny",
                "- Delete files"
            ].join("\n")
        );

        await expect(appInstall(workspaceDir, sourceDir)).rejects.toThrow("App name must be username-style");
    });

    it("throws when destination app already exists", async () => {
        const sourceDir = path.join(sourceRoot, "github-reviewer");
        await fs.mkdir(sourceDir, { recursive: true });
        await fs.writeFile(
            path.join(sourceDir, "APP.md"),
            [
                "---",
                "name: github-reviewer",
                "title: GitHub Reviewer",
                "description: Reviews pull requests",
                "---",
                "",
                "## System Prompt",
                "",
                "You are a focused PR review assistant."
            ].join("\n")
        );
        await fs.writeFile(
            path.join(sourceDir, "PERMISSIONS.md"),
            [
                "## Source Intent",
                "",
                "Review pull requests safely.",
                "",
                "## Rules",
                "",
                "### Allow",
                "- Read files",
                "",
                "### Deny",
                "- Delete files"
            ].join("\n")
        );
        await fs.mkdir(path.join(workspaceDir, "apps", "github-reviewer"), { recursive: true });

        await expect(appInstall(workspaceDir, sourceDir)).rejects.toThrow("App already installed");
    });

    it("throws when source is missing PERMISSIONS.md", async () => {
        const sourceDir = path.join(sourceRoot, "missing-permissions");
        await fs.mkdir(sourceDir, { recursive: true });
        await fs.writeFile(
            path.join(sourceDir, "APP.md"),
            [
                "---",
                "name: missing-permissions",
                "title: Missing Permissions",
                "description: Missing permissions file",
                "---",
                "",
                "## System Prompt",
                "",
                "You are a focused app."
            ].join("\n")
        );

        await expect(appInstall(workspaceDir, sourceDir)).rejects.toThrow("missing PERMISSIONS.md");
    });
});
