import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { observationLogAppend } from "./observationLogAppend.js";

describe("observationLogAppend", () => {
    let tmpDir: string;

    beforeEach(async () => {
        tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "obs-log-"));
    });

    afterEach(async () => {
        await fs.rm(tmpDir, { recursive: true, force: true });
    });

    const fixedTime = new Date("2026-02-21T14:30:00Z").getTime();

    it("appends formatted observations to observations.md", async () => {
        await observationLogAppend(
            tmpDir,
            [{ text: "User prefers dark mode", context: "Changed theme settings during onboarding" }],
            fixedTime
        );

        const content = await fs.readFile(path.join(tmpDir, "observations.md"), "utf8");
        expect(content).toBe(
            [
                "## 2026-02-21 14:30",
                "- **Text**: User prefers dark mode",
                "- **Context**: Changed theme settings during onboarding",
                "",
                ""
            ].join("\n")
        );
    });

    it("appends multiple observations in one call", async () => {
        await observationLogAppend(
            tmpDir,
            [
                { text: "Fact A", context: "Ctx A" },
                { text: "Fact B", context: "Ctx B" }
            ],
            fixedTime
        );

        const content = await fs.readFile(path.join(tmpDir, "observations.md"), "utf8");
        expect(content).toBe(
            [
                "## 2026-02-21 14:30",
                "- **Text**: Fact A",
                "- **Context**: Ctx A",
                "",
                "## 2026-02-21 14:30",
                "- **Text**: Fact B",
                "- **Context**: Ctx B",
                "",
                ""
            ].join("\n")
        );
    });

    it("does not write when observations array is empty", async () => {
        await observationLogAppend(tmpDir, [], fixedTime);

        const exists = await fs
            .access(path.join(tmpDir, "observations.md"))
            .then(() => true)
            .catch(() => false);
        expect(exists).toBe(false);
    });

    it("appends to existing file content", async () => {
        await fs.writeFile(path.join(tmpDir, "observations.md"), "# Observations Log\n\n");

        await observationLogAppend(tmpDir, [{ text: "New fact", context: "New ctx" }], fixedTime);

        const content = await fs.readFile(path.join(tmpDir, "observations.md"), "utf8");
        expect(content.startsWith("# Observations Log\n\n")).toBe(true);
        expect(content).toContain("## 2026-02-21 14:30");
        expect(content).toContain("- **Text**: New fact");
    });

    it("creates directory if it does not exist", async () => {
        const nested = path.join(tmpDir, "deep", "nested");

        await observationLogAppend(nested, [{ text: "Fact", context: "Ctx" }], fixedTime);

        const content = await fs.readFile(path.join(nested, "observations.md"), "utf8");
        expect(content).toContain("## 2026-02-21 14:30");
    });
});
