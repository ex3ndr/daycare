import { mkdtemp, rm } from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";

import bcrypt from "bcryptjs";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ExposeProxy } from "./exposeProxy.js";

let proxy: ExposeProxy;
const cleanup: Array<() => Promise<void>> = [];

beforeEach(() => {
  proxy = new ExposeProxy();
});

afterEach(async () => {
  await proxy.stop();
  while (cleanup.length > 0) {
    const item = cleanup.pop();
    if (!item) {
      continue;
    }
    await item();
  }
});

describe("ExposeProxy", () => {
  it("routes by host header to local TCP targets", async () => {
    const upstream = await serverStart((request, response) => {
      response.statusCode = 200;
      response.end(`${request.method}:${request.url}`);
    });

    const { port } = await proxy.start();
    proxy.addRoute("app.example.com", { type: "port", port: upstream.port });

    const result = await requestRun({
      port,
      host: "app.example.com",
      path: "/health?check=1",
      method: "POST"
    });

    expect(result.statusCode).toBe(200);
    expect(result.body).toBe("POST:/health?check=1");
  });

  it("forwards JSON request bodies", async () => {
    const upstream = await serverStart((request, response) => {
      const chunks: Buffer[] = [];
      request.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
      request.on("end", () => {
        response.statusCode = 200;
        response.end(Buffer.concat(chunks).toString("utf8"));
      });
    });

    const { port } = await proxy.start();
    proxy.addRoute("json.example.com", { type: "port", port: upstream.port });

    const payload = JSON.stringify({ hello: "world" });
    const result = await requestRun({
      port,
      host: "json.example.com",
      path: "/echo",
      method: "POST",
      headers: {
        "content-type": "application/json",
        "content-length": String(Buffer.byteLength(payload))
      },
      body: payload
    });

    expect(result.statusCode).toBe(200);
    expect(result.body).toBe(payload);
  });

  it("routes requests to unix socket targets", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "daycare-expose-unix-"));
    const socketPath = path.join(tempDir, "server.sock");
    const server = http.createServer((_, response) => {
      response.statusCode = 200;
      response.end("unix-ok");
    });
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(socketPath, () => resolve());
    });
    cleanup.push(async () => {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await rm(tempDir, { recursive: true, force: true });
    });

    const { port } = await proxy.start();
    proxy.addRoute("unix.example.com", { type: "unix", path: socketPath });

    const result = await requestRun({
      port,
      host: "unix.example.com",
      path: "/"
    });

    expect(result.statusCode).toBe(200);
    expect(result.body).toBe("unix-ok");
  });

  it("enforces basic auth when configured", async () => {
    const upstream = await serverStart((_, response) => {
      response.statusCode = 200;
      response.end("ok");
    });

    const passwordHash = await bcrypt.hash("secret", 10);
    const { port } = await proxy.start();
    proxy.addRoute("auth.example.com", { type: "port", port: upstream.port }, passwordHash);

    const noAuth = await requestRun({
      port,
      host: "auth.example.com",
      path: "/"
    });
    expect(noAuth.statusCode).toBe(401);
    expect(noAuth.headers["www-authenticate"]).toBe('Basic realm="daycare"');

    const wrongAuth = await requestRun({
      port,
      host: "auth.example.com",
      path: "/",
      headers: {
        authorization: `Basic ${Buffer.from("daycare:wrong").toString("base64")}`
      }
    });
    expect(wrongAuth.statusCode).toBe(401);

    const validAuth = await requestRun({
      port,
      host: "auth.example.com",
      path: "/",
      headers: {
        authorization: `Basic ${Buffer.from("daycare:secret").toString("base64")}`
      }
    });
    expect(validAuth.statusCode).toBe(200);
    expect(validAuth.body).toBe("ok");

    proxy.updateRoute("auth.example.com", { passwordHash: null });
    const afterDisable = await requestRun({
      port,
      host: "auth.example.com",
      path: "/"
    });
    expect(afterDisable.statusCode).toBe(200);
    expect(afterDisable.body).toBe("ok");
  });
});

async function serverStart(
  handler: (
    request: http.IncomingMessage,
    response: http.ServerResponse
  ) => void
): Promise<{ port: number }> {
  const server = http.createServer(handler);
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve());
  });
  cleanup.push(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to resolve upstream address");
  }
  return { port: address.port };
}

async function requestRun(options: {
  port: number;
  host: string;
  path: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}): Promise<{ statusCode: number; body: string; headers: http.IncomingHttpHeaders }> {
  return new Promise((resolve, reject) => {
    const request = http.request(
      {
        hostname: "127.0.0.1",
        port: options.port,
        path: options.path,
        method: options.method ?? "GET",
        headers: {
          host: options.host,
          ...(options.headers ?? {})
        }
      },
      (response) => {
        const chunks: Buffer[] = [];
        response.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
        response.on("end", () => {
          resolve({
            statusCode: response.statusCode ?? 0,
            body: Buffer.concat(chunks).toString("utf8"),
            headers: response.headers
          });
        });
      }
    );

    request.on("error", reject);
    request.end(options.body ?? "");
  });
}
