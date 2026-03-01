import type http from "node:http";
import type { EngineEventBus } from "../../../engine/ipc/events.js";
import { appCorsApply } from "../../app-server/appHttp.js";

export type EventsStreamInput = {
    request: http.IncomingMessage;
    response: http.ServerResponse;
    eventBus: EngineEventBus;
};

/**
 * Opens an SSE stream and forwards engine events to the client.
 * Expects: caller has already authenticated the request.
 */
export function eventsStream(input: EventsStreamInput): void {
    appCorsApply(input.response);
    input.response.writeHead(200, {
        "content-type": "text/event-stream",
        "cache-control": "no-cache",
        connection: "keep-alive"
    });

    const connected = {
        type: "connected",
        timestamp: new Date().toISOString()
    };
    input.response.write(`data: ${JSON.stringify(connected)}\n\n`);

    const unsubscribe = input.eventBus.onEvent((event) => {
        if (input.response.writableEnded) {
            return;
        }
        input.response.write(`data: ${JSON.stringify(event)}\n\n`);
    });

    input.request.on("close", () => {
        unsubscribe();
        if (!input.response.writableEnded) {
            input.response.end();
        }
    });
}
