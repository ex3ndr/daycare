import { promises as fs } from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import type { TaskDbRecord } from "../../../storage/databaseTypes.js";
import type { TaskParameter } from "../../modules/tasks/taskParameterTypes.js";
import { taskCoreIdIs } from "./taskCoreIdIs.js";
import { taskCoreRootResolve } from "./taskCoreRootResolve.js";

type CoreTaskFrontmatter = {
    title?: string;
    description?: string;
    parameters?: TaskParameter[];
};

/**
 * Resolves one bundled core task definition into a task-shaped record for a user.
 * Expects: taskId uses the core namespace and the backing files exist under the core tasks root.
 */
export async function taskCoreResolve(options: {
    taskId: string;
    userId: string;
    root?: string;
}): Promise<TaskDbRecord | null> {
    const taskId = options.taskId.trim();
    if (!taskCoreIdIs(taskId)) {
        return null;
    }

    const userId = options.userId.trim();
    if (!userId) {
        return null;
    }

    const slug = taskId.slice("core:".length);
    if (!slug) {
        return null;
    }

    const root = options.root ?? taskCoreRootResolve();
    const taskDir = path.join(root, slug);
    const descriptionPath = path.join(taskDir, "description.md");
    const codePath = path.join(taskDir, "task.py");

    try {
        const [descriptionSource, code, descriptionStats, codeStats] = await Promise.all([
            fs.readFile(descriptionPath, "utf8"),
            fs.readFile(codePath, "utf8"),
            fs.stat(descriptionPath),
            fs.stat(codePath)
        ]);
        const parsed = matter(descriptionSource);
        const metadata = taskCoreFrontmatterNormalize(parsed.data as Record<string, unknown>);
        const createdAt = Math.trunc(Math.min(descriptionStats.mtimeMs, codeStats.mtimeMs));
        const updatedAt = Math.trunc(Math.max(descriptionStats.mtimeMs, codeStats.mtimeMs));
        const descriptionBody = parsed.content.trim();
        const title = metadata.title?.trim().length ? metadata.title.trim() : taskCoreTitleFormat(slug);
        const description =
            descriptionBody.length > 0
                ? descriptionBody
                : metadata.description?.trim().length
                  ? metadata.description.trim()
                  : null;

        return {
            id: taskId,
            userId,
            version: 1,
            validFrom: createdAt,
            validTo: null,
            title,
            description,
            code,
            parameters: metadata.parameters ?? null,
            createdAt,
            updatedAt
        };
    } catch (error) {
        const code = (error as NodeJS.ErrnoException).code;
        if (code === "ENOENT" || code === "ENOTDIR") {
            return null;
        }
        throw error;
    }
}

function taskCoreFrontmatterNormalize(data: Record<string, unknown>): CoreTaskFrontmatter {
    const result: CoreTaskFrontmatter = {};
    if (typeof data.title === "string") {
        result.title = data.title;
    }
    if (typeof data.description === "string") {
        result.description = data.description;
    }
    if (Array.isArray(data.parameters)) {
        const parameters = data.parameters
            .map((value) => taskCoreParameterNormalize(value))
            .filter((value): value is TaskParameter => value !== null);
        if (parameters.length > 0) {
            result.parameters = parameters;
        }
    }
    return result;
}

function taskCoreParameterNormalize(value: unknown): TaskParameter | null {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return null;
    }
    const name = Reflect.get(value, "name");
    const type = Reflect.get(value, "type");
    const nullable = Reflect.get(value, "nullable");
    if (typeof name !== "string" || name.trim().length === 0) {
        return null;
    }
    if (type !== "integer" && type !== "float" && type !== "string" && type !== "boolean" && type !== "any") {
        return null;
    }
    if (typeof nullable !== "boolean") {
        return null;
    }
    return {
        name: name.trim(),
        type,
        nullable
    };
}

function taskCoreTitleFormat(slug: string): string {
    return slug
        .split(/[-_]+/g)
        .map((part) => (part.length > 0 ? part.charAt(0).toUpperCase() + part.slice(1) : part))
        .join(" ");
}
