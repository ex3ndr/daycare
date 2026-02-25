import type { PropsWithChildren, ReactNode } from "react";
import { appConfig } from "@/config";
import { authValidateToken } from "@/modules/auth/authApi";
import { authStorage } from "@/modules/auth/authStorage";
import { authStoreCreate } from "@/modules/auth/authStoreCreate";

export const useAuthStore = authStoreCreate({
    baseUrl: appConfig.apiBaseUrl,
    storage: authStorage,
    validateToken: authValidateToken
});

export function AuthProvider({ children }: PropsWithChildren): ReactNode {
    return children;
}
