export type WorkspaceConfig = {
    firstName: string;
    lastName: string | null;
    bio: string;
    about: string | null;
    systemPrompt: string;
    memory: boolean;
    emoji: string;
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
    emoji: string;
    createdAt: number;
    updatedAt: number;
};
