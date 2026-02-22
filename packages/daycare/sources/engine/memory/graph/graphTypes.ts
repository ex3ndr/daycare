export type GraphNodeFrontmatter = {
    title: string;
    description: string;
    createdAt: number;
    updatedAt: number;
};

export type GraphNode = {
    id: string;
    frontmatter: GraphNodeFrontmatter;
    content: string;
    refs: string[];
};

export type GraphTree = {
    root: GraphNode;
    children: Map<string, GraphNode[]>;
};

export const GRAPH_ROOT_NODE_ID = "__root__";
