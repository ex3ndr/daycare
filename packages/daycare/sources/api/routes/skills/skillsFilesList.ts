import { promises as fs } from "node:fs";
import path from "node:path";

export type SkillFileMetadata = {
    path: string;
    size: number;
    updatedAt: number;
    download: {
        method: "GET";
        path: string;
    };
};

export type SkillsFilesListInput = {
    skillId: string;
    sourcePath: string;
};

/**
 * Lists every regular file under a skill directory with download metadata.
 * Expects: sourcePath points to SKILL.md inside the skill root directory.
 */
export async function skillsFilesList(input: SkillsFilesListInput): Promise<SkillFileMetadata[]> {
    const skillRoot = path.dirname(input.sourcePath);
    const files: SkillFileMetadata[] = [];
    await skillsFilesCollect({
        skillId: input.skillId,
        skillRoot,
        relativeDir: "",
        files
    });
    files.sort((left, right) => left.path.localeCompare(right.path));
    return files;
}

type SkillsFilesCollectInput = {
    skillId: string;
    skillRoot: string;
    relativeDir: string;
    files: SkillFileMetadata[];
};

async function skillsFilesCollect(input: SkillsFilesCollectInput): Promise<void> {
    const absoluteDir = input.relativeDir ? path.join(input.skillRoot, input.relativeDir) : input.skillRoot;
    let entries: Array<import("node:fs").Dirent>;
    try {
        entries = await fs.readdir(absoluteDir, { withFileTypes: true });
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") {
            return;
        }
        throw error;
    }

    entries.sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
        if (entry.isSymbolicLink()) {
            continue;
        }

        const relativePath = input.relativeDir ? path.join(input.relativeDir, entry.name) : entry.name;
        if (entry.isDirectory()) {
            await skillsFilesCollect({
                ...input,
                relativeDir: relativePath
            });
            continue;
        }
        if (!entry.isFile()) {
            continue;
        }

        const absolutePath = path.join(input.skillRoot, relativePath);
        let stat: import("node:fs").Stats;
        try {
            stat = await fs.stat(absolutePath);
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code === "ENOENT") {
                continue;
            }
            throw error;
        }

        const normalizedPath = relativePath.split(path.sep).join("/");
        input.files.push({
            path: normalizedPath,
            size: stat.size,
            updatedAt: Math.floor(stat.mtimeMs),
            download: {
                method: "GET",
                path: `/skills/${encodeURIComponent(input.skillId)}/download?path=${encodeURIComponent(normalizedPath)}`
            }
        });
    }
}
