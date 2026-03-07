export type WorkspaceConfig = {
    firstName: string;
    lastName: string | null;
    bio: string;
    about: string | null;
    systemPrompt: string;
    memory: boolean;
};

export type WorkspaceRecord = {
    userId: string;
    ownerUserId: string;
    nametag: string;
    firstName: string;
    lastName: string | null;
    bio: string;
    about: string | null;
    systemPrompt: string;
    memory: boolean;
    createdAt: number;
    updatedAt: number;
};
