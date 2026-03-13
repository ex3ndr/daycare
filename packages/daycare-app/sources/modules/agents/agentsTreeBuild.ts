import { agentDisplayName } from "./agentDisplayName";
import type { AgentListItem } from "./agentsTypes";

type AgentsTreeNode = {
    agent: AgentListItem;
    children: AgentsTreeNode[];
    orphaned: boolean;
};

export type AgentsTree = {
    text: string;
    nodeCount: number;
    linkCount: number;
    rootCount: number;
    orphanCount: number;
};

function agentDepth(path: string | null): number {
    if (!path) {
        return 0;
    }

    return path.split("/").filter(Boolean).length;
}

function agentCompare(left: AgentListItem, right: AgentListItem): number {
    const depthDifference = agentDepth(left.path) - agentDepth(right.path);
    if (depthDifference !== 0) {
        return depthDifference;
    }

    const leftKey = left.path ?? `~${left.agentId}`;
    const rightKey = right.path ?? `~${right.agentId}`;
    return leftKey.localeCompare(rightKey);
}

function agentParentPath(path: string | null): string | null {
    if (!path) {
        return null;
    }

    const segments = path.split("/").filter(Boolean);
    if (segments.length < 2) {
        return null;
    }

    if (segments[segments.length - 1] === "memory") {
        return `/${segments.slice(0, -1).join("/")}`;
    }

    const marker = segments[segments.length - 2];
    if (marker === "sub" || marker === "search") {
        return `/${segments.slice(0, -2).join("/")}`;
    }

    return null;
}

function treeLabel(node: AgentsTreeNode): string {
    const parts = [node.agent.kind, node.agent.lifecycle];
    if (node.orphaned) {
        parts.push("orphan");
    }

    return `${agentDisplayName(node.agent)} [${parts.join(", ")}]`;
}

function treeLinesPush(lines: string[], nodes: AgentsTreeNode[], prefix: string): void {
    nodes.forEach((node, index) => {
        const isLast = index === nodes.length - 1;
        const branch = isLast ? "\\- " : "+- ";
        const nextPrefix = `${prefix}${isLast ? "   " : "|  "}`;

        lines.push(`${prefix}${branch}${treeLabel(node)}`);
        treeLinesPush(lines, node.children, nextPrefix);
    });
}

/**
 * Builds a file-tree style text view from path-linked agents.
 * Expects: agents come from the app list endpoint and may omit path for detached records.
 */
export function agentsTreeBuild(agents: AgentListItem[]): AgentsTree {
    if (agents.length === 0) {
        return {
            text: "agents/\n\\- (empty)",
            nodeCount: 0,
            linkCount: 0,
            rootCount: 0,
            orphanCount: 0
        };
    }

    const sortedAgents = [...agents].sort(agentCompare);
    const nodeByPath = new Map<string, AgentsTreeNode>();
    const roots: AgentsTreeNode[] = [];

    let linkCount = 0;
    let orphanCount = 0;

    for (const agent of sortedAgents) {
        const node: AgentsTreeNode = {
            agent,
            children: [],
            orphaned: false
        };

        if (agent.path) {
            nodeByPath.set(agent.path, node);
        }

        const parentPath = agentParentPath(agent.path);
        const parent = parentPath ? nodeByPath.get(parentPath) : null;

        if (parent) {
            parent.children.push(node);
            linkCount += 1;
            continue;
        }

        if (parentPath) {
            node.orphaned = true;
            orphanCount += 1;
        }

        roots.push(node);
    }

    const lines = ["agents/"];
    treeLinesPush(lines, roots, "");

    return {
        text: lines.join("\n"),
        nodeCount: sortedAgents.length,
        linkCount,
        rootCount: roots.length,
        orphanCount
    };
}
