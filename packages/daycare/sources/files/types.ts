export type StoredFile = {
    id: string;
    name: string;
    path: string;
    mimeType: string;
    size: number;
    source: string;
    createdAt: string;
};

export type FileReference = {
    id: string;
    name: string;
    mimeType: string;
    size: number;
    path: string;
};
