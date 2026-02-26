export type GraphNodeFrontmatter = {
    title: string;
    description: string;
    parents: string[];
    version: number;
    createdAt: number;
    updatedAt: number;
};

export type GraphNode = {
    id: string;
    frontmatter: GraphNodeFrontmatter;
    content: string;
    refs: string[];
};

export type GraphNodeVersion = GraphNode & {
    changeDescription: string;
};

export type GraphTree = {
    root: GraphNode;
    children: Map<string, GraphNode[]>;
};

export const GRAPH_ROOT_NODE_ID = "__root__";
export const GRAPH_VERSION_FILE_PATTERN = /^(.+)\.v(\d+)\.md$/;
