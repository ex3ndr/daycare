/**
 * Formats an app id into its public tool name.
 * Expects: appId is a validated app manifest name.
 */
export function appToolNameFormat(appId: string): string {
  return `app_${appId.replace(/-/g, "_")}`;
}
