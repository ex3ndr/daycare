import type { EngineEvent } from "../ipc/events.js";
import type { UserConfiguration } from "./userConfigurationTypes.js";

export const USER_CONFIGURATION_SYNC_EVENT = "user.configuration.sync";

/**
 * Builds the user-configuration sync event sent over SSE.
 * Expects: configuration is already normalized to the persisted user shape.
 */
export function userConfigurationSyncEventBuild(userId: string, configuration: UserConfiguration): EngineEvent {
    return {
        type: USER_CONFIGURATION_SYNC_EVENT,
        userId,
        payload: {
            configuration
        },
        timestamp: new Date().toISOString()
    };
}
