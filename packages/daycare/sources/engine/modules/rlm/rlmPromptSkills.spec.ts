import type { Tool } from "@mariozechner/pi-ai";
import Handlebars from "handlebars";
import { describe, expect, it } from "vitest";
import type { AgentSkill } from "@/types";

import { agentPromptBundledRead } from "../../agents/ops/agentPromptBundledRead.js";
import { skillPromptFormat } from "../../skills/skillPromptFormat.js";
import { rlmNoToolsPromptBuild } from "./rlmNoToolsPromptBuild.js";
import { rlmToolDescriptionBuild } from "./rlmToolDescriptionBuild.js";

type RenderSystemPromptOptions = {
    toolsText: string;
    skillsPrompt: string;
    noToolsPrompt?: string;
    isForeground?: boolean;
    featuresSay?: boolean;
};

const SECTION_SEPARATOR = "\n\n---\n\n";

const skills: AgentSkill[] = [
    {
        id: "core:scheduling",
        name: "scheduling",
        description: "Set up recurring tasks",
        source: "core",
        path: "/tmp/skills/scheduling/SKILL.md",
        sandbox: true
    }
];

const tools = [
    { name: "run_python", description: "", parameters: {} },
    { name: "echo", description: "Echo text", parameters: {} },
    { name: "skill", description: "Load skill", parameters: {} }
] as unknown as Tool[];

describe("system prompt skills rendering", () => {
    it("includes the skill list once in classic mode", async () => {
        const prompt = await renderSystemPrompt({
            toolsText: "Tool notes",
            skillsPrompt: skillPromptFormat(skills)
        });

        expect(occurrences(prompt, "<name>scheduling</name>")).toBe(1);
    });

    it("includes the skill list once in rlm mode", async () => {
        const prompt = await renderSystemPrompt({
            toolsText: await rlmToolDescriptionBuild(tools),
            skillsPrompt: skillPromptFormat(skills)
        });

        expect(occurrences(prompt, "<name>scheduling</name>")).toBe(1);
    });

    it("includes the skill list once in no-tools mode", async () => {
        const prompt = await renderSystemPrompt({
            toolsText: "Tool notes",
            skillsPrompt: skillPromptFormat(skills),
            noToolsPrompt: await rlmNoToolsPromptBuild(tools),
            featuresSay: true
        });

        expect(occurrences(prompt, "<name>scheduling</name>")).toBe(1);
    });

    it("shows static skills guidance for background agents", async () => {
        const prompt = await renderSystemPrompt({
            toolsText: "",
            skillsPrompt: "",
            isForeground: false
        });

        expect(prompt).toContain("## Skills (mandatory)");
        expect(prompt).toContain("Before replying, scan the skill descriptions below:");
        expect(prompt).not.toContain("For local skill authoring:");
    });

    it("does not include say-tag instructions in no-tools mode for background agents", async () => {
        const prompt = await renderSystemPrompt({
            toolsText: "Tool notes",
            skillsPrompt: "",
            noToolsPrompt: await rlmNoToolsPromptBuild(tools, { isForeground: false }),
            isForeground: false,
            featuresSay: true
        });

        expect(prompt).toContain("## Python Execution");
        expect(prompt).not.toContain("If you include `<say>` in the same response");
        expect(prompt).not.toContain("you MUST emit `<say>` with your response");
    });
});

async function renderSystemPrompt(options: RenderSystemPromptOptions): Promise<string> {
    const sectionContext = {
        isForeground: options.isForeground ?? true,
        date: "2026-02-17",
        os: "Darwin 24.0.0",
        arch: "arm64",
        model: "test-model",
        provider: "test-provider",
        workspace: "/tmp/workspace",
        network: false,
        events: false,
        connector: "test",
        canSendFiles: false,
        fileSendModes: "",
        messageFormatPrompt: "",
        channelId: "channel-1",
        userId: "user-1",
        cronTaskId: "",
        cronTaskName: "",
        cronMemoryPath: "",
        cronFilesPath: "",
        appFolderPath: "",
        workspacePermissionGranted: false,
        soulPath: "/tmp/SOUL.md",
        userPath: "/tmp/USER.md",
        agentsPath: "/tmp/AGENTS.md",
        toolsPath: "/tmp/TOOLS.md",
        memoryPath: "/tmp/MEMORY.md",
        skillsPrompt: options.skillsPrompt,
        parentAgentId: "",
        configDir: "/tmp/.daycare",
        skillsPath: "/tmp/.daycare/skills",
        soul: "soul",
        user: "user",
        agents: "agents",
        tools: options.toolsText,
        memory: "memory",
        additionalWriteDirs: [],
        agentPrompt: "",
        noToolsPrompt: options.noToolsPrompt ?? ""
    };
    const [
        preambleSection,
        autonomousOperationSection,
        permissionsSection,
        toolCallingSection,
        agentsTopologySignalsChannelsSection,
        skillsSection,
        formattingSection,
        memorySection,
        environmentSection
    ] = await Promise.all([
        sectionRender("SYSTEM.md", sectionContext),
        sectionRender("SYSTEM_AGENCY.md", sectionContext),
        sectionRender("SYSTEM_PERMISSIONS.md", sectionContext),
        (async () => {
            const base = await sectionRender("SYSTEM_TOOLS.md", sectionContext);
            const noTools = (options.noToolsPrompt ?? "").trim();
            return [base, noTools].filter((section) => section.length > 0).join("\n\n");
        })(),
        sectionRender("SYSTEM_TOPOLOGY.md", sectionContext),
        (async () => {
            const base = await sectionRender("SYSTEM_SKILLS.md", sectionContext);
            const dynamicSkills = options.skillsPrompt.trim();
            return [base, dynamicSkills].filter((section) => section.length > 0).join("\n\n");
        })(),
        sectionRender("SYSTEM_FORMATTING.md", sectionContext),
        sectionRender("SYSTEM_MEMORY.md", sectionContext),
        sectionRender("SYSTEM_ENVIRONMENT.md", sectionContext)
    ]);
    return [
        preambleSection,
        autonomousOperationSection,
        permissionsSection,
        toolCallingSection,
        agentsTopologySignalsChannelsSection,
        skillsSection,
        formattingSection,
        memorySection,
        environmentSection
    ]
        .filter((section) => section.length > 0)
        .join(SECTION_SEPARATOR)
        .trim();
}

async function sectionRender(templateName: string, context: Record<string, unknown>): Promise<string> {
    const source = await agentPromptBundledRead(templateName);
    return Handlebars.compile<Record<string, unknown>>(source)(context).trim();
}

function occurrences(haystack: string, needle: string): number {
    return haystack.split(needle).length - 1;
}
