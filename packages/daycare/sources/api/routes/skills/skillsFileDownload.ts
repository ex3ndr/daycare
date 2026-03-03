import { promises as fs } from "node:fs";
import path from "node:path";
import type { AgentSkill } from "@/types";

export type SkillsFileDownloadInput = {
    skillId: string;
    filePath: string;
    skills: {
        list: () => Promise<AgentSkill[]>;
    };
};

export type SkillsFileDownloadResult =
    | {
          ok: true;
          file: {
              path: string;
              size: number;
              updatedAt: number;
              mimeType: string;
              filename: string;
          };
          content: Buffer;
      }
    | {
          ok: false;
          statusCode: number;
          error: string;
      };

/**
 * Resolves one skill file and returns binary content for download.
 * Expects: filePath is a skill-relative path and must not escape the skill root.
 */
export async function skillsFileDownload(input: SkillsFileDownloadInput): Promise<SkillsFileDownloadResult> {
    const skillId = input.skillId.trim();
    if (!skillId) {
        return { ok: false, statusCode: 400, error: "skillId is required." };
    }

    const requestedPath = input.filePath.trim();
    if (!requestedPath) {
        return { ok: false, statusCode: 400, error: "path is required." };
    }

    const listed = await input.skills.list();
    const skill = listed.find((entry) => entry.id === skillId);
    if (!skill) {
        return { ok: false, statusCode: 404, error: "Skill not found." };
    }

    const skillRoot = path.dirname(skill.sourcePath);
    const normalizedRequestedPath = requestedPath.split("\\").join("/");
    const absolutePath = path.resolve(skillRoot, normalizedRequestedPath);
    const relativePath = path.relative(skillRoot, absolutePath);
    if (!relativePath || relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
        return { ok: false, statusCode: 400, error: "Invalid file path." };
    }

    let stat: import("node:fs").Stats;
    try {
        stat = await fs.stat(absolutePath);
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") {
            return { ok: false, statusCode: 404, error: "File not found." };
        }
        throw error;
    }
    if (!stat.isFile()) {
        return { ok: false, statusCode: 400, error: "Requested path is not a file." };
    }

    const content = await fs.readFile(absolutePath);
    const normalizedPath = relativePath.split(path.sep).join("/");
    return {
        ok: true,
        file: {
            path: normalizedPath,
            size: stat.size,
            updatedAt: Math.floor(stat.mtimeMs),
            mimeType: skillsFileMimeTypeResolve(normalizedPath),
            filename: path.basename(normalizedPath)
        },
        content
    };
}

function skillsFileMimeTypeResolve(filePath: string): string {
    const extension = path.extname(filePath).toLowerCase();
    if (extension === ".md") {
        return "text/markdown; charset=utf-8";
    }
    if (extension === ".json") {
        return "application/json; charset=utf-8";
    }
    if (extension === ".ts" || extension === ".tsx" || extension === ".js" || extension === ".mjs") {
        return "text/plain; charset=utf-8";
    }
    if (extension === ".txt") {
        return "text/plain; charset=utf-8";
    }
    return "application/octet-stream";
}
