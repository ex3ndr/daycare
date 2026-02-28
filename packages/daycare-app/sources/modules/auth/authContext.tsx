import type { PropsWithChildren, ReactNode } from "react";
import { authValidateToken } from "@/modules/auth/authApi";
import { authStorage } from "@/modules/auth/authStorage";
import { authStoreCreate } from "@/modules/auth/authStoreCreate";
import { authTelegramSessionResolve } from "@/modules/auth/authTelegramSessionResolve";

export const useAuthStore = authStoreCreate({
    storage: authStorage,
    validateToken: authValidateToken,
    sessionResolve: authTelegramSessionResolve
});

export function AuthProvider({ children }: PropsWithChildren): ReactNode {
    return children;
}
