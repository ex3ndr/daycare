import http from "node:http";
import { pipeline } from "node:stream/promises";

const proxyPort = parsePort(process.argv[2], "proxy port");
const listenPort = parsePort(process.argv[3] ?? "18221", "listen port");

const server = http.createServer((request, response) => {
  const headers: http.OutgoingHttpHeaders = { ...request.headers };
  delete headers.connection;

  const upstream = http.request(
    {
      hostname: "127.0.0.1",
      port: proxyPort,
      method: request.method,
      path: request.url,
      headers
    },
    (upstreamResponse) => {
      response.writeHead(upstreamResponse.statusCode ?? 502, upstreamResponse.headers);
      void pipeline(upstreamResponse, response).catch(() => {
        response.destroy();
      });
    }
  );

  upstream.on("error", () => {
    if (response.headersSent) {
      response.destroy();
      return;
    }
    response.statusCode = 502;
    response.setHeader("content-type", "text/plain; charset=utf-8");
    response.end("Expose upstream unavailable.");
  });

  void pipeline(request, upstream).catch(() => {
    upstream.destroy();
  });
});

server.listen({ host: "0.0.0.0", port: listenPort }, () => {
  process.stdout.write(
    `local-expose forwarder listening on :${listenPort} -> 127.0.0.1:${proxyPort}\n`
  );
});

process.on("SIGTERM", () => {
  server.close(() => process.exit(0));
});
process.on("SIGINT", () => {
  server.close(() => process.exit(0));
});

function parsePort(value: string | undefined, label: string): number {
  if (!value) {
    throw new Error(`Missing ${label}.`);
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
    throw new Error(`Invalid ${label}: ${value}`);
  }
  return parsed;
}
