import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { appPermissionsParse } from "./appPermissionsParse.js";
import { appPermissionsValidate } from "./appPermissionsValidate.js";
import { appRuleApply } from "./appRuleApply.js";

describe("appRuleApply", () => {
  let appDir: string;

  beforeEach(async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "daycare-app-rules-"));
    appDir = path.join(root, "github-reviewer");
    await fs.mkdir(appDir, { recursive: true });
    await fs.writeFile(
      path.join(appDir, "APP.md"),
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
      path.join(appDir, "PERMISSIONS.md"),
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
  });

  afterEach(async () => {
    await fs.rm(path.dirname(appDir), { recursive: true, force: true });
  });

  it("adds deny rules", async () => {
    const result = await appRuleApply({
      appDir,
      action: "add_deny",
      rule: "Access secrets"
    });
    expect(result.changed).toBe(true);

    const permissions = await permissionsRead(appDir);
    expect(permissions.rules.deny.map((rule) => rule.text)).toContain("Access secrets");
  });

  it("adds allow rules", async () => {
    const result = await appRuleApply({
      appDir,
      action: "add_allow",
      rule: "Access network"
    });
    expect(result.changed).toBe(true);

    const permissions = await permissionsRead(appDir);
    expect(permissions.rules.allow.map((rule) => rule.text)).toContain("Access network");
  });

  it("removes deny rules", async () => {
    const result = await appRuleApply({
      appDir,
      action: "remove_deny",
      rule: "Delete files"
    });
    expect(result.changed).toBe(true);

    const permissions = await permissionsRead(appDir);
    expect(permissions.rules.deny.map((rule) => rule.text)).not.toContain("Delete files");
  });

  it("removes allow rules", async () => {
    const result = await appRuleApply({
      appDir,
      action: "remove_allow",
      rule: "Read files"
    });
    expect(result.changed).toBe(true);

    const permissions = await permissionsRead(appDir);
    expect(permissions.rules.allow.map((rule) => rule.text)).not.toContain("Read files");
  });
});

async function permissionsRead(appDir: string) {
  const raw = await fs.readFile(path.join(appDir, "PERMISSIONS.md"), "utf8");
  return appPermissionsValidate(appPermissionsParse(raw));
}
