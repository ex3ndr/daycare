import matter from "gray-matter";

import { GRAPH_ROOT_NODE_ID, type GraphNode, type GraphNodeFrontmatter } from "./graphTypes.js";

type GraphNodeFrontmatterInput = {
    title?: unknown;
    description?: unknown;
    parents?: unknown;
    refs?: unknown;
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
    const refs = graphNodeRefsNormalize(id, frontmatterInput.refs, content);

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
    const defaultParents = id === GRAPH_ROOT_NODE_ID ? [] : [GRAPH_ROOT_NODE_ID];

    const title = stringValue(input.title) ?? defaultTitle;
    const description = stringValue(input.description) ?? defaultDescription;
    const parents = graphNodeParentsNormalize(id, input.parents, defaultParents);
    const createdAt = numberValue(input.createdAt) ?? 0;
    const updatedAt = numberValue(input.updatedAt) ?? createdAt;

    return {
        title,
        description,
        parents,
        createdAt,
        updatedAt
    };
}

function graphNodeParentsNormalize(id: string, value: unknown, fallback: string[]): string[] {
    if (id === GRAPH_ROOT_NODE_ID) {
        return [];
    }

    const parents = stringArrayValues(value).filter((parentId) => parentId !== id);
    if (parents.length > 0) {
        return parents;
    }
    return fallback;
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

function graphNodeRefsNormalize(id: string, value: unknown, content: string): string[] {
    const refs = new Set<string>();
    for (const ref of stringArrayValues(value)) {
        if (ref !== id) {
            refs.add(ref);
        }
    }
    for (const ref of graphNodeRefsExtract(content)) {
        if (ref !== id) {
            refs.add(ref);
        }
    }
    return [...refs];
}

function stringArrayValues(value: unknown): string[] {
    if (!Array.isArray(value)) {
        return [];
    }

    const seen = new Set<string>();
    const values: string[] = [];
    for (const entry of value) {
        if (typeof entry !== "string") {
            continue;
        }
        const normalized = entry.trim();
        if (normalized.length === 0 || seen.has(normalized)) {
            continue;
        }
        seen.add(normalized);
        values.push(normalized);
    }

    return values;
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
