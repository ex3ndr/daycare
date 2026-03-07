import { apiUrl } from "../api/apiUrl";
import { sseBufferParse } from "./sseLineParse";

export type SseClientStatus = "connected" | "disconnected" | "error";

export type SseClientOptions = {
    baseUrl: string;
    token: string;
    workspaceId: string | null;
    onEvent: (event: { type: string; payload?: unknown }) => void;
    onStatus: (status: SseClientStatus) => void;
};

export type SseClient = {
    close: () => void;
};

/**
 * Creates an SSE client using fetch with streaming.
 * Parses SSE data lines and dispatches typed events.
 * Reports connection status via onStatus callback.
 *
 * Expects: baseUrl points to a server with GET /events SSE endpoint.
 */
export function sseClientCreate(options: SseClientOptions): SseClient {
    const controller = new AbortController();
    let closed = false;

    const run = async () => {
        try {
            const response = await fetch(apiUrl(options.baseUrl, "/events", options.workspaceId), {
                headers: { authorization: `Bearer ${options.token}` },
                signal: controller.signal
            });

            if (!response.ok) {
                options.onStatus("error");
                return;
            }

            if (!response.body) {
                options.onStatus("error");
                return;
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = "";

            while (!closed) {
                const { done, value } = await reader.read();
                if (done) {
                    break;
                }

                buffer += decoder.decode(value, { stream: true });
                const [dataStrings, remaining] = sseBufferParse(buffer);
                buffer = remaining;

                for (const dataStr of dataStrings) {
                    try {
                        const parsed = JSON.parse(dataStr) as { type: string; payload?: unknown };
                        options.onEvent(parsed);
                    } catch {
                        // Skip malformed JSON
                    }
                }
            }
        } catch (error) {
            if (closed) {
                return;
            }
            // AbortError is expected on close
            if (error instanceof DOMException && error.name === "AbortError") {
                return;
            }
        }

        if (!closed) {
            options.onStatus("disconnected");
        }
    };

    void run();

    return {
        close() {
            closed = true;
            controller.abort();
        }
    };
}
