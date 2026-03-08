import type { TodoDbRecord } from "@/types";

/**
 * Maps a stored todo record into the API response shape.
 * Expects: record is the active version returned from the repository.
 */
export function todoPublicBuild(record: TodoDbRecord): {
    id: string;
    parentId: string | null;
    title: string;
    description: string;
    status: TodoDbRecord["status"];
    rank: string;
    version: number;
    createdAt: number;
    updatedAt: number;
} {
    return {
        id: record.id,
        parentId: record.parentId,
        title: record.title,
        description: record.description,
        status: record.status,
        rank: record.rank,
        version: record.version ?? 1,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt
    };
}
