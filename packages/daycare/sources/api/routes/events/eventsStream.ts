import type http from "node:http";
import type { EngineEventBus } from "../../../engine/ipc/events.js";
import { appCorsApply } from "../../app-server/appHttp.js";

const KEEPALIVE_INTERVAL_MS = 30_000;

export type EventsStreamInput = {
    request: http.IncomingMessage;
    response: http.ServerResponse;
    eventBus: EngineEventBus;
    userId: string;
};

/**
 * Opens an SSE stream and forwards engine events to the client.
 * Filters events by userId — only events without userId or matching userId are forwarded.
 * Sends keepalive comments every 30s to prevent proxy timeouts.
 *
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
        // Skip events scoped to a different user
        if (event.userId && event.userId !== input.userId) {
            return;
        }
        input.response.write(`data: ${JSON.stringify(event)}\n\n`);
    });

    const keepaliveTimer = setInterval(() => {
        if (input.response.writableEnded) {
            clearInterval(keepaliveTimer);
            return;
        }
        input.response.write(`:keepalive\n\n`);
    }, KEEPALIVE_INTERVAL_MS);

    input.request.on("close", () => {
        clearInterval(keepaliveTimer);
        unsubscribe();
        if (!input.response.writableEnded) {
            input.response.end();
        }
    });
}
