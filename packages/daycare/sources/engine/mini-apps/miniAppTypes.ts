export type MiniAppFileInput = {
    path: string;
    content: string;
    encoding?: "utf8" | "base64";
};

export type MiniAppCreateInput = {
    id: string;
    title: string;
    icon: string;
    html: string;
    files?: MiniAppFileInput[];
};

export type MiniAppUpdateInput = {
    title?: string;
    icon?: string;
    html?: string;
    files?: MiniAppFileInput[];
    deletePaths?: string[];
};

export type MiniAppRecord = {
    id: string;
    userId: string;
    version: number;
    title: string;
    icon: string;
    createdAt: number;
    updatedAt: number;
};
