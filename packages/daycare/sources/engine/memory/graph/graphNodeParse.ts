import matter from "gray-matter";

import { GRAPH_ROOT_NODE_ID, type GraphNode, type GraphNodeFrontmatter } from "./graphTypes.js";

type GraphNodeFrontmatterInput = {
    title?: unknown;
    description?: unknown;
    path?: unknown;
    createdAt?: unknown;
    updatedAt?: unknown;
};

const REF_PATTERN = /\[\[([^[\]]+)\]\]/g;

/**
 * Parses a markdown graph node into normalized graph-memory shape.
 * Expects: id maps to filename without extension; raw can include optional YAML frontmatter.
 */
export function graphNodeParse(id: string, raw: string): GraphNode {
    let content = raw;
    let frontmatterInput: GraphNodeFrontmatterInput = {};
    try {
        const parsed = matter(raw);
        content = parsed.content;
        frontmatterInput = parsed.data as GraphNodeFrontmatterInput;
    } catch {
        // Keep raw content when frontmatter cannot be parsed.
    }

    const frontmatter = graphNodeFrontmatterNormalize(id, frontmatterInput);
    const refs = graphNodeRefsExtract(content);

    return {
        id,
        frontmatter,
        content,
        refs
    };
}

function graphNodeFrontmatterNormalize(id: string, input: GraphNodeFrontmatterInput): GraphNodeFrontmatter {
    const defaultTitle = id === GRAPH_ROOT_NODE_ID ? "Memory Summary" : id;
    const defaultDescription = id === GRAPH_ROOT_NODE_ID ? "Structured summary of all memories" : "";

    const title = stringValue(input.title) ?? defaultTitle;
    const description = stringValue(input.description) ?? defaultDescription;
    const path = pathValue(input.path);
    const createdAt = numberValue(input.createdAt) ?? 0;
    const updatedAt = numberValue(input.updatedAt) ?? createdAt;

    return {
        title,
        description,
        path,
        createdAt,
        updatedAt
    };
}

function graphNodeRefsExtract(content: string): string[] {
    const refs: string[] = [];
    const seen = new Set<string>();
    let match = REF_PATTERN.exec(content);
    while (match) {
        const ref = (match[1] ?? "").trim();
        if (ref.length > 0 && !seen.has(ref)) {
            seen.add(ref);
            refs.push(ref);
        }
        match = REF_PATTERN.exec(content);
    }
    REF_PATTERN.lastIndex = 0;
    return refs;
}

function stringValue(value: unknown): string | null {
    if (typeof value !== "string") {
        return null;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}

function numberValue(value: unknown): number | null {
    if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
        return value;
    }
    if (typeof value === "string") {
        const parsed = Number(value);
        if (Number.isFinite(parsed) && parsed >= 0) {
            return parsed;
        }
    }
    return null;
}

function pathValue(value: unknown): string[] {
    if (!Array.isArray(value)) {
        return [];
    }
    return value.map((item) => (typeof item === "string" ? item.trim() : "")).filter((item) => item.length > 0);
}
