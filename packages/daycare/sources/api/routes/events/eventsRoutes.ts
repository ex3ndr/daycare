import type http from "node:http";
import type { EngineEventBus } from "../../../engine/ipc/events.js";
import { eventsStream } from "./eventsStream.js";

export type EventsRouteContext = {
    eventBus: EngineEventBus | null;
    sendJson: (response: http.ServerResponse, statusCode: number, payload: Record<string, unknown>) => void;
};

/**
 * Routes authenticated SSE event stream requests.
 * Returns true if /events was handled.
 */
export async function eventsRouteHandle(
    request: http.IncomingMessage,
    response: http.ServerResponse,
    pathname: string,
    context: EventsRouteContext
): Promise<boolean> {
    if (pathname !== "/events" || request.method !== "GET") {
        return false;
    }

    if (!context.eventBus) {
        context.sendJson(response, 503, {
            ok: false,
            error: "Event stream unavailable."
        });
        return true;
    }

    eventsStream({
        request,
        response,
        eventBus: context.eventBus
    });
    return true;
}
