export type MiniAppListItem = {
    id: string;
    userId: string;
    version: number;
    title: string;
    icon: string;
    createdAt: number;
    updatedAt: number;
};

export type MiniAppLaunch = {
    launchPath: string;
    expiresAt: number;
};
