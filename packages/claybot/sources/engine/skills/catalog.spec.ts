import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";

import { describe, expect, it } from "vitest";

import { formatSkillsPrompt, listRegisteredSkills, listSkillsFromRoot } from "./catalog.js";

describe("listSkills", () => {
  it("collects core and plugin skills with xml formatting", async () => {
    const baseDir = await fs.mkdtemp(path.join(os.tmpdir(), "claybot-skills-"));
    try {
      const coreRoot = path.join(baseDir, "core");
      const coreSkillDir = path.join(coreRoot, "deploy");
      await fs.mkdir(coreSkillDir, { recursive: true });

      const pluginSkillDir = path.join(baseDir, "plugin-skill");
      await fs.mkdir(pluginSkillDir, { recursive: true });

      const coreSkillPath = path.join(coreSkillDir, "SKILL.md");
      const pluginSkillPath = path.join(pluginSkillDir, "SKILL.md");
      await fs.writeFile(
        coreSkillPath,
        "---\nname: deploy\ndescription: \"Use <cron> & heartbeat\"\n---\n\nCore skill"
      );
      await fs.writeFile(
        pluginSkillPath,
        "---\nname: plugin-skill\ndescription: Manage <xml> safely\n---\n\nPlugin skill"
      );

      const coreSkills = await listSkillsFromRoot(coreRoot, {
        source: "core",
        root: coreRoot
      });
      const pluginSkills = await listRegisteredSkills([
        { pluginId: "alpha", path: pluginSkillPath }
      ]);

      expect(coreSkills).toHaveLength(1);
      expect(pluginSkills).toHaveLength(1);

      const prompt = formatSkillsPrompt([...coreSkills, ...pluginSkills]);
      expect(prompt).toContain("<skills>");
      expect(prompt).toContain(`<name>deploy</name>`);
      expect(prompt).toContain(`<description>Use &lt;cron&gt; &amp; heartbeat</description>`);
      expect(prompt).toContain(`<description>Manage &lt;xml&gt; safely</description>`);
      expect(prompt).toContain(coreSkillPath);
      expect(prompt).toContain(pluginSkillPath);
    } finally {
      await fs.rm(baseDir, { recursive: true, force: true });
    }
  });
});
