import { describe, expect, it } from "vitest";

import { skillPromptFormat } from "./skillPromptFormat.js";
import type { AgentSkill } from "./skillTypes.js";

describe("skillPromptFormat", () => {
    it("formats skills as escaped XML", () => {
        const skills: AgentSkill[] = [
            {
                id: "core:deploy",
                name: "deploy",
                description: "Use <cron> & heartbeat",
                path: "/tmp/deploy/SKILL.md",
                source: "core",
                sandbox: true
            },
            {
                id: "plugin:alpha/tooling",
                name: "tooling",
                description: "Manage <xml>",
                path: "/tmp/plugin/skill/SKILL.md",
                source: "plugin",
                pluginId: "alpha"
            },
            {
                id: "core:deploy",
                name: "deploy",
                description: "Use <cron> & heartbeat",
                path: "/tmp/deploy/SKILL.md",
                source: "core"
            }
        ];

        const prompt = skillPromptFormat(skills);

        expect(prompt).toContain("<available_skills>");
        expect(prompt).toContain("</available_skills>");
        expect(prompt).toContain("<name>deploy</name>");
        expect(prompt).toContain("Use &lt;cron&gt; &amp; heartbeat");
        expect(prompt).toContain("<source>plugin:alpha</source>");
        expect(prompt).toContain("<sandbox>true</sandbox>");
        expect(prompt).not.toContain("/tmp/deploy/SKILL.md");
        expect(prompt).not.toContain("## Skills (mandatory)");
        expect(prompt.match(/<name>deploy<\/name>/g)).toHaveLength(1);
    });
});
