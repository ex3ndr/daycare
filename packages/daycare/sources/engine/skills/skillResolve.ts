import { promises as fs, constants as fsConstants } from "node:fs";
import path from "node:path";
import matter from "gray-matter";

import { getLogger } from "../../log.js";
import { SKILL_FILENAME } from "./skillConstants.js";
import type { AgentSkill, SkillSource } from "./skillTypes.js";

type SkillFrontmatter = {
    name?: string;
    description?: string;
    sandbox?: boolean;
    permissions?: string[];
};

const logger = getLogger("engine.skills");

/**
 * Loads a skill file, parses its frontmatter, and builds a normalized skill record.
 *
 * Expects: filePath points to a readable file; unreadable files return null.
 */
export async function skillResolve(filePath: string, source: SkillSource, root?: string): Promise<AgentSkill | null> {
    const resolvedPath = path.resolve(filePath);
    const readable = await skillFileReadable(resolvedPath);
    if (!readable) {
        logger.warn({ path: resolvedPath }, "skip: Skill file not readable; skipping");
        return null;
    }

    let content = "";
    try {
        content = await fs.readFile(resolvedPath, "utf8");
    } catch (error) {
        logger.warn({ path: resolvedPath, error }, "skip: Skill file not readable; skipping");
        return null;
    }

    const metadata = skillFrontmatterParse(content);
    const name = metadata.name?.trim().length ? metadata.name.trim() : skillNameFormat(resolvedPath);
    const description = metadata.description?.trim().length ? metadata.description.trim() : null;
    const id = skillIdBuild(resolvedPath, source, root);

    return {
        id,
        name,
        description,
        sandbox: metadata.sandbox,
        permissions: metadata.permissions,
        sourcePath: resolvedPath,
        source: source.source,
        pluginId: source.source === "plugin" ? source.pluginId : undefined
    };
}

async function skillFileReadable(filePath: string): Promise<boolean> {
    try {
        const stats = await fs.stat(filePath);
        if (!stats.isFile()) {
            return false;
        }
        await fs.access(filePath, fsConstants.R_OK);
        return true;
    } catch (error) {
        const code = (error as NodeJS.ErrnoException).code;
        if (code === "ENOENT" || code === "EACCES") {
            return false;
        }
        throw error;
    }
}

function skillFrontmatterParse(content: string): SkillFrontmatter {
    try {
        const parsed = matter(content);
        return skillFrontmatterNormalize(parsed.data as Record<string, unknown>);
    } catch {
        return {};
    }
}

function skillFrontmatterNormalize(data: Record<string, unknown>): SkillFrontmatter {
    const result: SkillFrontmatter = {};
    if (typeof data.name === "string") {
        result.name = data.name;
    }
    if (typeof data.description === "string") {
        result.description = data.description;
    }

    if (typeof data.sandbox === "boolean") {
        result.sandbox = data.sandbox;
    } else if (typeof data.sandbox === "string") {
        const normalized = data.sandbox.trim().toLowerCase();
        if (normalized === "true") {
            result.sandbox = true;
        } else if (normalized === "false") {
            result.sandbox = false;
        }
    }

    if (Array.isArray(data.permissions)) {
        const permissions = data.permissions
            .filter((value): value is string => typeof value === "string")
            .map((value) => value.trim())
            .filter((value) => value.length > 0);
        if (permissions.length > 0) {
            result.permissions = Array.from(new Set(permissions));
        }
    } else if (typeof data.permissions === "string") {
        const permission = data.permissions.trim();
        if (permission.length > 0) {
            result.permissions = [permission];
        }
    }
    return result;
}

function skillIdBuild(filePath: string, source: SkillSource, root?: string): string {
    const fileName = path.basename(filePath).toLowerCase();
    let slug = "";

    if (fileName === SKILL_FILENAME) {
        if (root) {
            slug = path.relative(root, path.dirname(filePath));
        } else {
            slug = path.basename(path.dirname(filePath));
        }
    } else {
        slug = path.basename(filePath, path.extname(filePath));
    }

    const normalized = slug.length > 0 ? slug.split(path.sep).join("/") : "skill";
    if (source.source === "plugin") {
        return `plugin:${source.pluginId}/${normalized}`;
    }
    if (source.source === "config") {
        return `config:${normalized}`;
    }
    if (source.source === "user") {
        return `user:${normalized}`;
    }
    if (source.source === "agents") {
        return `agents:${normalized}`;
    }
    return `core:${normalized}`;
}

function skillNameFormat(filePath: string): string {
    const fileName = path.basename(filePath).toLowerCase();
    if (fileName === SKILL_FILENAME) {
        return skillNameNormalize(path.basename(path.dirname(filePath)));
    }
    return skillNameNormalize(path.basename(filePath, path.extname(filePath)));
}

function skillNameNormalize(value: string): string {
    return value.replace(/[-_]+/g, " ").trim();
}
