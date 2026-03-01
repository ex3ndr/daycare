import { EventEmitter } from "node:events";
import { describe, expect, it } from "vitest";
import { EngineEventBus } from "../../../engine/ipc/events.js";
import { eventsStream } from "./eventsStream.js";

type MockResponse = {
    headers: Record<string, string>;
    statusCode: number | null;
    chunks: string[];
    writableEnded: boolean;
    setHeader: (name: string, value: string) => void;
    writeHead: (statusCode: number, headers: Record<string, string>) => void;
    write: (chunk: string) => boolean;
    end: () => void;
};

function responseMockCreate(): MockResponse {
    return {
        headers: {},
        statusCode: null,
        chunks: [],
        writableEnded: false,
        setHeader(name, value) {
            this.headers[name.toLowerCase()] = value;
        },
        writeHead(statusCode, headers) {
            this.statusCode = statusCode;
            for (const [key, value] of Object.entries(headers)) {
                this.headers[key.toLowerCase()] = value;
            }
        },
        write(chunk) {
            this.chunks.push(chunk);
            return true;
        },
        end() {
            this.writableEnded = true;
        }
    };
}

describe("eventsStream", () => {
    it("sets SSE headers and sends connected event", () => {
        const request = new EventEmitter();
        const response = responseMockCreate();
        const eventBus = new EngineEventBus();

        eventsStream({
            request: request as never,
            response: response as never,
            eventBus
        });

        expect(response.statusCode).toBe(200);
        expect(response.headers["content-type"]).toBe("text/event-stream");
        expect(response.headers["cache-control"]).toBe("no-cache");
        expect(response.headers.connection).toBe("keep-alive");
        expect(response.headers["access-control-allow-origin"]).toBe("*");
        expect(response.chunks[0]).toContain('"type":"connected"');
    });

    it("streams emitted events", () => {
        const request = new EventEmitter();
        const response = responseMockCreate();
        const eventBus = new EngineEventBus();

        eventsStream({
            request: request as never,
            response: response as never,
            eventBus
        });

        eventBus.emit("agent.created", { agentId: "a1" });

        const combined = response.chunks.join("");
        expect(combined).toContain('"type":"agent.created"');
        expect(combined).toContain('"agentId":"a1"');
    });

    it("unsubscribes and ends on request close", () => {
        const request = new EventEmitter();
        const response = responseMockCreate();
        const eventBus = new EngineEventBus();

        eventsStream({
            request: request as never,
            response: response as never,
            eventBus
        });

        const beforeCloseLength = response.chunks.length;
        request.emit("close");
        eventBus.emit("signal.generated", { id: "s1" });

        expect(response.writableEnded).toBe(true);
        expect(response.chunks.length).toBe(beforeCloseLength);
    });
});
