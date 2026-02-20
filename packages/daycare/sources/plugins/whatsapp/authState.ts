import type {
    AuthenticationCreds,
    AuthenticationState,
    SignalDataSet,
    SignalDataTypeMap,
    SignalKeyStore
} from "@whiskeysockets/baileys";
import { BufferJSON, initAuthCreds, proto } from "@whiskeysockets/baileys";

import type { AuthEntry, AuthStore } from "../../auth/store.js";

const AUTH_KEY_PREFIX = "whatsapp:";

type AuthStateData = {
    creds: AuthenticationCreds;
    keys: Record<string, unknown>;
};

/**
 * Creates a Baileys auth state that stores credentials in the AuthStore.
 *
 * Expects: AuthStore instance and instance ID.
 * Returns: auth state object compatible with makeWASocket.
 */
export async function useAuthStoreState(
    authStore: AuthStore,
    instanceId: string
): Promise<{
    state: AuthenticationState;
    saveCreds: () => Promise<void>;
}> {
    const authKey = `${AUTH_KEY_PREFIX}${instanceId}`;

    // Load existing auth data or create new
    const existing = await authStore.getEntry(authKey);
    let authData: AuthStateData;

    if (existing?.creds) {
        // Parse stored credentials
        authData = {
            creds: JSON.parse(JSON.stringify(existing.creds), BufferJSON.reviver),
            keys: (existing.keys as Record<string, unknown>) ?? {}
        };
    } else {
        // Initialize new credentials
        authData = {
            creds: initAuthCreds(),
            keys: {}
        };
    }

    const saveCreds = async () => {
        const entry: AuthEntry = {
            type: "oauth",
            creds: JSON.parse(JSON.stringify(authData.creds, BufferJSON.replacer)),
            keys: authData.keys
        };
        await authStore.setEntry(authKey, entry);
    };

    // Create keys store that auto-saves on changes
    const keys: SignalKeyStore = {
        get: async <T extends keyof SignalDataTypeMap>(
            type: T,
            ids: string[]
        ): Promise<{ [id: string]: SignalDataTypeMap[T] }> => {
            const data: { [id: string]: SignalDataTypeMap[T] } = {};
            for (const id of ids) {
                const key = `${type}-${id}`;
                const value = authData.keys[key];
                if (value) {
                    if (type === "app-state-sync-key") {
                        data[id] = proto.Message.AppStateSyncKeyData.fromObject(
                            value
                        ) as unknown as SignalDataTypeMap[T];
                    } else {
                        data[id] = value as unknown as SignalDataTypeMap[T];
                    }
                }
            }
            return data;
        },
        set: async (dataMap: SignalDataSet): Promise<void> => {
            for (const [type, entries] of Object.entries(dataMap)) {
                if (!entries) continue;
                for (const [id, value] of Object.entries(entries)) {
                    const key = `${type}-${id}`;
                    if (value) {
                        authData.keys[key] = JSON.parse(JSON.stringify(value, BufferJSON.replacer));
                    } else {
                        delete authData.keys[key];
                    }
                }
            }
            await saveCreds();
        }
    };

    return {
        state: { creds: authData.creds, keys },
        saveCreds
    };
}

/**
 * Checks if WhatsApp auth exists in the AuthStore.
 */
export async function hasAuthState(authStore: AuthStore, instanceId: string): Promise<boolean> {
    const authKey = `${AUTH_KEY_PREFIX}${instanceId}`;
    const entry = await authStore.getEntry(authKey);
    return entry?.creds !== undefined;
}

/**
 * Clears WhatsApp auth from the AuthStore.
 */
export async function clearAuthState(authStore: AuthStore, instanceId: string): Promise<void> {
    const authKey = `${AUTH_KEY_PREFIX}${instanceId}`;
    await authStore.remove(authKey);
}
