import { agentDisplayName } from "./agentDisplayName";
import type { AgentListItem } from "./agentsTypes";

type AgentsGraphNode = {
    agent: AgentListItem;
    nodeId: string;
    parentNodeId: string | null;
};

export type AgentsGraph = {
    mermaid: string;
    nodeCount: number;
    edgeCount: number;
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

function mermaidLabel(agent: AgentListItem): string {
    const label = `${agentDisplayName(agent)} | ${agent.kind} | ${agent.lifecycle}`;
    return label.replaceAll("\\", "/").replaceAll('"', "'");
}

/**
 * Builds a Mermaid flowchart string from path-linked agents.
 * Expects: agents come from the app list endpoint and may omit path for detached records.
 */
export function agentsGraphBuild(agents: AgentListItem[]): AgentsGraph {
    if (agents.length === 0) {
        return {
            mermaid: 'graph TD\n    empty["No agents"]',
            nodeCount: 0,
            edgeCount: 0,
            rootCount: 0,
            orphanCount: 0
        };
    }

    const sortedAgents = [...agents].sort(agentCompare);
    const nodeByPath = new Map<string, AgentsGraphNode>();
    const nodes: AgentsGraphNode[] = sortedAgents.map((agent, index) => {
        const node = {
            agent,
            nodeId: `agent${index}`,
            parentNodeId: null
        };

        if (agent.path) {
            nodeByPath.set(agent.path, node);
        }

        return node;
    });

    let edgeCount = 0;
    let rootCount = 0;
    let orphanCount = 0;
    const orphanComments: string[] = [];

    for (const node of nodes) {
        const parentPath = agentParentPath(node.agent.path);
        if (!parentPath) {
            rootCount += 1;
            continue;
        }

        const parent = nodeByPath.get(parentPath);
        if (!parent) {
            orphanCount += 1;
            rootCount += 1;
            orphanComments.push(`%% Missing parent path for ${agentDisplayName(node.agent)}: ${parentPath}`);
            continue;
        }

        node.parentNodeId = parent.nodeId;
        edgeCount += 1;
    }

    const lines = [
        "graph TD",
        ...nodes.map((node) => `    ${node.nodeId}["${mermaidLabel(node.agent)}"]`),
        "",
        ...nodes
            .filter((node) => node.parentNodeId !== null)
            .map((node) => `    ${node.parentNodeId} --> ${node.nodeId}`),
        ...orphanComments.map((comment) => `    ${comment}`)
    ]
        .filter((line, index, all) => !(line === "" && all[index - 1] === ""))
        .filter((line, index, all) => !(line === "" && index === all.length - 1));

    return {
        mermaid: lines.join("\n"),
        nodeCount: nodes.length,
        edgeCount,
        rootCount,
        orphanCount
    };
}
