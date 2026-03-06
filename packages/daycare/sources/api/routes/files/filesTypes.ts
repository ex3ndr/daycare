export type FileEntry = {
    name: string;
    type: "file" | "directory";
    size: number;
    modifiedAt: number;
};

export type FileRoot = {
    id: string;
    label: string;
    path: string;
};
