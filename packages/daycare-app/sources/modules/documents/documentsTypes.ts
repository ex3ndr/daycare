export type DocumentItem = {
    id: string;
    slug: string;
    title: string;
    description: string;
    body: string;
    parentId: string | null;
    createdAt: number;
    updatedAt: number;
};

export type DocumentTreeNode = {
    document: DocumentItem;
    children: DocumentTreeNode[];
};

export type FlatTreeEntry = {
    document: DocumentItem;
    depth: number;
    hasChildren: boolean;
    expanded: boolean;
};
