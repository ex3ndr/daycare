import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { skillContentLoad } from "./skillContentLoad.js";

describe("skillContentLoad", () => {
    it("strips YAML frontmatter and returns body", async () => {
        const skillPath = await skillFileCreate("---\nname: deploy\ndescription: Deploy\n---\n\n# Deploy\nUse script.");
        try {
            await expect(skillContentLoad(skillPath)).resolves.toBe("# Deploy\nUse script.");
        } finally {
            await fs.rm(path.dirname(skillPath), { recursive: true, force: true });
        }
    });

    it("returns full content when frontmatter is absent", async () => {
        const skillPath = await skillFileCreate("# No Frontmatter\nBody");
        try {
            await expect(skillContentLoad(skillPath)).resolves.toBe("# No Frontmatter\nBody");
        } finally {
            await fs.rm(path.dirname(skillPath), { recursive: true, force: true });
        }
    });

    it("returns empty string when body is empty", async () => {
        const skillPath = await skillFileCreate("---\nname: empty\n---\n");
        try {
            await expect(skillContentLoad(skillPath)).resolves.toBe("");
        } finally {
            await fs.rm(path.dirname(skillPath), { recursive: true, force: true });
        }
    });

    it("keeps body content that contains --- delimiters", async () => {
        const skillPath = await skillFileCreate("---\nname: dash\n---\n\n# Title\n---\nStill body.");
        try {
            await expect(skillContentLoad(skillPath)).resolves.toBe("# Title\n---\nStill body.");
        } finally {
            await fs.rm(path.dirname(skillPath), { recursive: true, force: true });
        }
    });
});

async function skillFileCreate(content: string): Promise<string> {
    const baseDir = await fs.mkdtemp(path.join(os.tmpdir(), "daycare-skill-content-"));
    const skillDir = path.join(baseDir, "skill");
    await fs.mkdir(skillDir, { recursive: true });
    const skillPath = path.join(skillDir, "SKILL.md");
    await fs.writeFile(skillPath, content);
    return skillPath;
}
