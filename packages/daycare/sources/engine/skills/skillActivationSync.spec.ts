import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";
import type { AgentSkill } from "@/types";

import { skillActivationKeyBuild } from "./skillActivationKeyBuild.js";
import { skillActivationSync } from "./skillActivationSync.js";

describe("skillActivationSync", () => {
    it("copies all skills on first run and keeps separate dirs for colliding names", async () => {
        const baseDir = await fs.mkdtemp(path.join(os.tmpdir(), "daycare-skill-activation-"));
        const activeRoot = path.join(baseDir, "active");
        try {
            const sharedName = "helper";
            const firstPath = await skillFileCreate(path.join(baseDir, "core"), sharedName, "core body");
            const secondPath = await skillFileCreate(path.join(baseDir, "plugin"), sharedName, "plugin body");
            const skills: AgentSkill[] = [
                skillBuild("core:helper", sharedName, "core", firstPath),
                skillBuild("plugin:foo/helper", sharedName, "plugin", secondPath, "foo")
            ];

            await skillActivationSync(skills, activeRoot);

            const firstKey = skillActivationKeyBuild(skills[0]!.id);
            const secondKey = skillActivationKeyBuild(skills[1]!.id);
            const firstTarget = path.join(activeRoot, firstKey, "SKILL.md");
            const secondTarget = path.join(activeRoot, secondKey, "SKILL.md");
            await expect(fs.readFile(firstTarget, "utf8")).resolves.toContain("core body");
            await expect(fs.readFile(secondTarget, "utf8")).resolves.toContain("plugin body");
            expect(firstTarget).not.toBe(secondTarget);
        } finally {
            await fs.rm(baseDir, { recursive: true, force: true });
        }
    });

    it("skips unchanged files by mtime and re-copies when source is newer", async () => {
        const baseDir = await fs.mkdtemp(path.join(os.tmpdir(), "daycare-skill-activation-"));
        const activeRoot = path.join(baseDir, "active");
        try {
            const sourcePath = await skillFileCreate(path.join(baseDir, "skills"), "deploy", "v1");
            const skill = skillBuild("config:deploy", "deploy", "config", sourcePath);
            const targetPath = path.join(activeRoot, skillActivationKeyBuild(skill.id), "SKILL.md");

            await skillActivationSync([skill], activeRoot);
            const firstStat = await fs.stat(targetPath);

            await new Promise((resolve) => setTimeout(resolve, 30));
            await skillActivationSync([skill], activeRoot);
            const secondStat = await fs.stat(targetPath);
            expect(secondStat.mtimeMs).toBe(firstStat.mtimeMs);

            const newerAt = new Date(Date.now() + 5_000);
            await fs.utimes(sourcePath, newerAt, newerAt);
            await fs.writeFile(sourcePath, await fs.readFile(sourcePath, "utf8"));
            await new Promise((resolve) => setTimeout(resolve, 30));
            await skillActivationSync([skill], activeRoot);
            const thirdStat = await fs.stat(targetPath);
            expect(thirdStat.mtimeMs).toBeGreaterThan(secondStat.mtimeMs);
        } finally {
            await fs.rm(baseDir, { recursive: true, force: true });
        }
    });

    it("cleans stale active entries when skills are removed", async () => {
        const baseDir = await fs.mkdtemp(path.join(os.tmpdir(), "daycare-skill-activation-"));
        const activeRoot = path.join(baseDir, "active");
        try {
            const sourcePath = await skillFileCreate(path.join(baseDir, "skills"), "cleanup", "body");
            const skill = skillBuild("config:cleanup", "cleanup", "config", sourcePath);
            const key = skillActivationKeyBuild(skill.id);

            await skillActivationSync([skill], activeRoot);
            await expect(fs.stat(path.join(activeRoot, key))).resolves.toBeTruthy();

            await skillActivationSync([], activeRoot);
            await expect(fs.stat(path.join(activeRoot, key))).rejects.toThrow();
        } finally {
            await fs.rm(baseDir, { recursive: true, force: true });
        }
    });

    it("skips missing and invalid-frontmatter sources without failing sync", async () => {
        const baseDir = await fs.mkdtemp(path.join(os.tmpdir(), "daycare-skill-activation-"));
        const activeRoot = path.join(baseDir, "active");
        try {
            const validPath = await skillFileCreate(path.join(baseDir, "skills"), "valid", "ok");
            const invalidDir = path.join(baseDir, "invalid");
            await fs.mkdir(invalidDir, { recursive: true });
            const invalidPath = path.join(invalidDir, "SKILL.md");
            await fs.writeFile(invalidPath, "---\ndescription: missing name\n---\n\nbad");

            const skills: AgentSkill[] = [
                skillBuild("config:valid", "valid", "config", validPath),
                skillBuild("config:missing", "missing", "config", path.join(baseDir, "missing", "SKILL.md")),
                skillBuild("config:invalid", "invalid", "config", invalidPath)
            ];

            await expect(skillActivationSync(skills, activeRoot)).resolves.toBeUndefined();
            await expect(
                fs.readFile(path.join(activeRoot, skillActivationKeyBuild("config:valid"), "SKILL.md"), "utf8")
            ).resolves.toContain("ok");
            await expect(fs.stat(path.join(activeRoot, skillActivationKeyBuild("config:missing")))).rejects.toThrow();
            await expect(fs.stat(path.join(activeRoot, skillActivationKeyBuild("config:invalid")))).rejects.toThrow();
        } finally {
            await fs.rm(baseDir, { recursive: true, force: true });
        }
    });
});

function skillBuild(
    id: string,
    name: string,
    source: AgentSkill["source"],
    sourcePath: string,
    pluginId?: string
): AgentSkill {
    return {
        id,
        name,
        source,
        sourcePath,
        pluginId
    };
}

async function skillFileCreate(root: string, name: string, body: string): Promise<string> {
    const skillDir = path.join(root, name);
    await fs.mkdir(skillDir, { recursive: true });
    const skillPath = path.join(skillDir, "SKILL.md");
    await fs.writeFile(
        skillPath,
        ["---", `name: ${name}`, "description: test", "---", "", `# ${name}`, "", body].join("\n"),
        "utf8"
    );
    return skillPath;
}
