export type TelegramProfile = {
    telegramUserId: string;
    firstName: string;
    lastName?: string;
    username?: string;
    bio?: string;
    phone?: string;
    avatarFileIds?: string[];
    avatarPaths?: string[];
    fetchedAt: number;
};
