import type { GraphNode } from "./graphTypes.js";

/**
 * Detects whether the node fields that define content meaning changed.
 * Expects: nodes are normalized graph-memory shapes.
 */
export function graphNodeChangeDetect(oldNode: GraphNode, newNode: GraphNode): boolean {
    if (oldNode.content !== newNode.content) {
        return true;
    }
    if (oldNode.frontmatter.title !== newNode.frontmatter.title) {
        return true;
    }
    if (oldNode.frontmatter.description !== newNode.frontmatter.description) {
        return true;
    }
    if (!stringArraysEqualSorted(oldNode.frontmatter.parents, newNode.frontmatter.parents)) {
        return true;
    }
    if (!stringArraysEqualSorted(oldNode.refs, newNode.refs)) {
        return true;
    }
    return false;
}

function stringArraysEqualSorted(left: string[], right: string[]): boolean {
    if (left.length !== right.length) {
        return false;
    }

    const leftSorted = [...left].sort();
    const rightSorted = [...right].sort();
    for (let i = 0; i < leftSorted.length; i += 1) {
        if (leftSorted[i] !== rightSorted[i]) {
            return false;
        }
    }
    return true;
}
