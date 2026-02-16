import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import { appDiscover } from "./appDiscover.js";

describe("appDiscover", () => {
  let workspaceDir: string;

  beforeEach(async () => {
    workspaceDir = await fs.mkdtemp(path.join(os.tmpdir(), "daycare-app-discover-"));
  });

  afterEach(async () => {
    await fs.rm(workspaceDir, { recursive: true, force: true });
  });

  it("returns discovered valid apps and skips invalid manifests", async () => {
    const validDir = path.join(workspaceDir, "apps", "github-reviewer");
    const invalidDir = path.join(workspaceDir, "apps", "broken");
    await fs.mkdir(validDir, { recursive: true });
    await fs.mkdir(invalidDir, { recursive: true });

    await fs.writeFile(
      path.join(validDir, "APP.md"),
      [
        "---",
        "name: github-reviewer",
        "title: GitHub Reviewer",
        "description: Reviews PRs",
        "---",
        "",
        "## System Prompt",
        "",
        "You are a focused PR review assistant."
      ].join("\n")
    );
    await fs.writeFile(
      path.join(validDir, "PERMISSIONS.md"),
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
    await fs.writeFile(
      path.join(invalidDir, "APP.md"),
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
      path.join(invalidDir, "PERMISSIONS.md"),
      [
        "## Source Intent",
        "",
        "Broken app.",
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

    const apps = await appDiscover(workspaceDir);
    expect(apps).toHaveLength(1);
    expect(apps[0]?.id).toBe("github-reviewer");
    expect(apps[0]?.path).toBe(validDir);
  });

  it("returns empty when apps directory does not exist", async () => {
    const apps = await appDiscover(workspaceDir);
    expect(apps).toEqual([]);
  });
});
