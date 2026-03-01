export type SwarmConfig = {
    nametag: string;
    firstName: string;
    lastName: string | null;
    bio: string;
    about: string | null;
    systemPrompt: string;
    memory: boolean;
};

export type SwarmRecord = {
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

export type SwarmContact = {
    swarmUserId: string;
    contactAgentId: string;
    swarmAgentId: string;
    messagesSent: number;
    messagesReceived: number;
    firstContactAt: number;
    lastContactAt: number;
};
