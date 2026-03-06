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

export type FilePreview = {
    path: string;
    name: string;
    size: number;
    modifiedAt: number;
    mimeType: string;
    encoding: "utf8" | "base64";
    content: string;
};
