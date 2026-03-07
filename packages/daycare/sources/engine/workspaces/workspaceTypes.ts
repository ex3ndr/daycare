export type WorkspaceConfig = {
    nametag: string;
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

export type WorkspaceContact = {
    workspaceUserId: string;
    contactAgentId: string;
    workspaceAgentId: string;
    messagesSent: number;
    messagesReceived: number;
    firstContactAt: number;
    lastContactAt: number;
};
