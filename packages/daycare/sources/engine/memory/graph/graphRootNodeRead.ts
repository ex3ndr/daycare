import { agentPromptBundledRead } from "../../agents/ops/agentPromptBundledRead.js";
import { GRAPH_ROOT_NODE_ID, type GraphNode } from "./graphTypes.js";

/**
 * Reads the virtual root node from the bundled prompt.
 * The root is never stored on disk — its content comes from source code.
 * Expects: `prompts/memory/MEMORY_ROOT.md` exists in the bundled prompts directory.
 */
export async function graphRootNodeRead(): Promise<GraphNode> {
    const content = await agentPromptBundledRead("memory/MEMORY_ROOT.md");
    return {
        id: GRAPH_ROOT_NODE_ID,
        frontmatter: {
            title: "Memory Summary",
            description: "Structured summary of all memories",
            createdAt: 0,
            updatedAt: 0
        },
        content,
        refs: []
    };
}
