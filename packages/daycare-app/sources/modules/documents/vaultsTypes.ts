export type VaultItem = {
    id: string;
    slug: string;
    title: string;
    description: string;
    body: string;
    parentId: string | null;
    createdAt: number;
    updatedAt: number;
};

export type VaultTreeNode = {
    document: VaultItem;
    children: VaultTreeNode[];
};

export type VaultVersion = {
    version: number;
    title: string;
    body: string;
    description: string;
    slug: string;
    createdAt: number;
    updatedAt: number;
    validFrom: number;
    validTo: number | null;
};

export type FlatTreeEntry = {
    document: VaultItem;
    depth: number;
    hasChildren: boolean;
    expanded: boolean;
};
