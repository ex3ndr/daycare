import { configLoad } from "../config/configLoad.js";
import { reloadEngine } from "../engine/ipc/client.js";

/**
 * Requests a live engine reload after updating settings on disk.
 * Expects: settingsPath points to the JSON settings file.
 */
export async function engineReloadRequest(settingsPath: string): Promise<boolean> {
  const config = await configLoad(settingsPath);
  try {
    await reloadEngine(config.socketPath);
    return true;
  } catch {
    return false;
  }
}
