export type TokenStatsRow = {
    hourStart: number;
    userId: string;
    agentId: string;
    model: string;
    input: number;
    output: number;
    cacheRead: number;
    cacheWrite: number;
    cost: number;
};

export type CostsPeriod = "24h" | "7d" | "30d";

export type CostsSummary = {
    totalCost: number;
    totalInput: number;
    totalOutput: number;
    totalCacheRead: number;
    totalCacheWrite: number;
};

export type CostsAgentBreakdown = {
    agentId: string;
    cost: number;
    rows: number;
};

export type CostsModelBreakdown = {
    model: string;
    cost: number;
    rows: number;
};

export type CostsTimeBucket = {
    timestamp: number;
    cost: number;
};
