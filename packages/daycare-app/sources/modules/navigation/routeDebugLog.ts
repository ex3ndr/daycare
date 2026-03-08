type RouteDebugValue = boolean | number | string | null | undefined;

type RouteDebugPayload = Record<string, RouteDebugValue | RouteDebugValue[]>;

function routeDebugValueFormat(value: RouteDebugValue | RouteDebugValue[]): string {
    if (Array.isArray(value)) {
        return value.length > 0 ? `[${value.map((item) => routeDebugValueFormat(item)).join(",")}]` : "[]";
    }
    if (typeof value === "string") {
        return JSON.stringify(value);
    }
    if (value === null) {
        return "null";
    }
    if (typeof value === "undefined") {
        return "undefined";
    }
    return String(value);
}

/**
 * Logs route startup state while debugging workspace refresh behavior.
 * Expects: payload values are small scalar values or short arrays.
 */
export function routeDebugLog(event: string, payload: RouteDebugPayload = {}): void {
    const devFlag = (globalThis as { __DEV__?: boolean }).__DEV__;
    if (devFlag === false) {
        return;
    }

    const details = Object.entries(payload).map(([key, value]) => `${key}=${routeDebugValueFormat(value)}`);
    console.info(`[daycare-app] route-debug event=${event}${details.length > 0 ? ` ${details.join(" ")}` : ""}`);
}
