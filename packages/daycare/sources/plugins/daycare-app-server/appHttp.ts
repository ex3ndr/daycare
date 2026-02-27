import type http from "node:http";

/**
 * Applies CORS headers to allow cross-origin requests from any origin.
 * Expects: response is a writable ServerResponse.
 */
export function appCorsApply(response: http.ServerResponse): void {
    response.setHeader("access-control-allow-origin", "*");
    response.setHeader("access-control-allow-methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
    response.setHeader("access-control-allow-headers", "content-type,authorization");
}

/**
 * Sends a JSON response with CORS headers and no-store caching.
 * Expects: payload is a JSON-serializable object.
 */
export function appSendJson(response: http.ServerResponse, statusCode: number, payload: Record<string, unknown>): void {
    appCorsApply(response);
    response.writeHead(statusCode, {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store"
    });
    response.end(`${JSON.stringify(payload)}\n`);
}

/**
 * Sends a plain text response with CORS headers and no-store caching.
 * Expects: text is a non-empty string.
 */
export function appSendText(response: http.ServerResponse, statusCode: number, text: string): void {
    appCorsApply(response);
    response.writeHead(statusCode, {
        "content-type": "text/plain; charset=utf-8",
        "cache-control": "no-store"
    });
    response.end(text);
}

/**
 * Reads and parses a JSON body from an incoming HTTP request.
 * Expects: request body is valid JSON or empty.
 */
export async function appReadJsonBody(request: http.IncomingMessage): Promise<Record<string, unknown>> {
    const chunks: Buffer[] = [];
    for await (const chunk of request) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }

    const text = Buffer.concat(chunks).toString("utf8").trim();
    if (!text) {
        return {};
    }

    try {
        const parsed = JSON.parse(text) as Record<string, unknown>;
        return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
        return {};
    }
}

/**
 * Starts the HTTP server listening on the given host and port.
 * Expects: server is not already listening.
 */
export function appServerListen(server: http.Server, host: string, port: number): Promise<void> {
    return new Promise((resolve, reject) => {
        const onError = (error: Error) => {
            server.off("listening", onListening);
            reject(error);
        };
        const onListening = () => {
            server.off("error", onError);
            resolve();
        };

        server.once("error", onError);
        server.once("listening", onListening);
        server.listen({ host, port });
    });
}

/**
 * Gracefully closes an HTTP server.
 * Expects: server is currently listening.
 */
export function appServerClose(server: http.Server): Promise<void> {
    return new Promise((resolve, reject) => {
        server.close((error) => {
            if (error) {
                reject(error);
                return;
            }
            resolve();
        });
    });
}
