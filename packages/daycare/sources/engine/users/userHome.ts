import path from "node:path";

import type { AgentPromptFilesPaths } from "../agents/ops/agentPromptFilesEnsure.js";

/**
 * Resolves all per-user home paths under the configured users directory.
 * Expects: usersDir is absolute and userId is a non-empty stable id.
 */
export class UserHome {
    readonly root: string;
    readonly skills: string;
    readonly skillsActive: string;
    readonly skillsPersonal: string;
    readonly apps: string;
    readonly home: string;
    readonly desktop: string;
    readonly downloads: string;
    readonly documents: string;
    readonly developer: string;
    readonly knowledge: string;
    readonly memory: string;
    readonly tmp: string;

    constructor(usersDir: string, userId: string) {
        this.root = path.resolve(usersDir, userId);
        this.skills = path.join(this.root, "skills");
        this.skillsActive = path.join(this.skills, "active");
        this.skillsPersonal = path.join(this.skills, "personal");
        this.apps = path.join(this.root, "apps");
        this.home = path.join(this.root, "home");
        this.desktop = path.join(this.home, "desktop");
        this.downloads = path.join(this.home, "downloads");
        this.documents = path.join(this.home, "documents");
        this.developer = path.join(this.home, "developer");
        this.knowledge = path.join(this.home, "knowledge");
        this.memory = path.join(this.home, "memory");
        this.tmp = path.join(this.home, "tmp");
    }

    knowledgePaths(): AgentPromptFilesPaths {
        return {
            soulPath: path.join(this.knowledge, "SOUL.md"),
            userPath: path.join(this.knowledge, "USER.md"),
            agentsPath: path.join(this.knowledge, "AGENTS.md"),
            toolsPath: path.join(this.knowledge, "TOOLS.md")
        };
    }
}
