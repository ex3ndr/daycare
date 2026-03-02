export type SecretSummary = {
    name: string;
    displayName: string;
    description: string;
    variableNames: string[];
    variableCount: number;
};

export type SecretCreateInput = {
    name: string;
    displayName?: string;
    description?: string;
    variables: Record<string, string | number | boolean>;
};

export type SecretUpdateInput = {
    displayName?: string;
    description?: string;
    variables?: Record<string, string | number | boolean>;
};
