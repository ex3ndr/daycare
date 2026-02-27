import type { PropsWithChildren, ReactNode } from "react";
import { authValidateToken } from "@/modules/auth/authApi";
import { authStorage } from "@/modules/auth/authStorage";
import { authStoreCreate } from "@/modules/auth/authStoreCreate";

export const useAuthStore = authStoreCreate({
    storage: authStorage,
    validateToken: authValidateToken
});

export function AuthProvider({ children }: PropsWithChildren): ReactNode {
    return children;
}
