import http from "node:http";
import { pipeline } from "node:stream/promises";

import bcrypt from "bcryptjs";
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from "fastify";

import type { ExposeTarget } from "./exposeTypes.js";
import { exposeDomainNormalize } from "./exposeTypes.js";

type ExposeProxyRoute = {
  target: ExposeTarget;
  passwordHash: string | null;
};

export type ExposeProxyUpdateInput = {
  passwordHash?: string | null;
};

/**
 * Reverse proxy with host-header routing and optional basic auth.
 * Expects: routes are keyed by normalized domain names.
 */
export class ExposeProxy {
  private server: FastifyInstance | null = null;
  private readonly routes = new Map<string, ExposeProxyRoute>();
  private listenPort: number | null = null;

  async start(): Promise<{ port: number }> {
    if (this.server && this.listenPort !== null) {
      return { port: this.listenPort };
    }

    const server = Fastify({ logger: false });
    server.removeAllContentTypeParsers();
    server.addContentTypeParser(
      "*",
      { parseAs: "buffer" },
      (_request, body, done) => {
        done(null, body);
      }
    );
    server.all("*", async (request, reply) => this.routeRequest(request, reply));

    await server.listen({ host: "127.0.0.1", port: 0 });
    const address = server.server.address();
    if (!address || typeof address === "string") {
      await server.close();
      throw new Error("Expose proxy failed to resolve listen address.");
    }

    this.server = server;
    this.listenPort = address.port;
    return { port: address.port };
  }

  async stop(): Promise<void> {
    if (!this.server) {
      return;
    }
    await this.server.close();
    this.server = null;
    this.listenPort = null;
  }

  addRoute(domain: string, target: ExposeTarget, passwordHash?: string): void {
    const normalizedDomain = exposeDomainNormalize(domain);
    this.routes.set(normalizedDomain, {
      target,
      passwordHash: passwordHash ?? null
    });
  }

  removeRoute(domain: string): void {
    const normalizedDomain = exposeDomainNormalize(domain);
    this.routes.delete(normalizedDomain);
  }

  updateRoute(domain: string, update: ExposeProxyUpdateInput): void {
    const normalizedDomain = exposeDomainNormalize(domain);
    const current = this.routes.get(normalizedDomain);
    if (!current) {
      throw new Error(`Expose proxy route not found: ${normalizedDomain}`);
    }

    this.routes.set(normalizedDomain, {
      ...current,
      passwordHash:
        "passwordHash" in update
          ? update.passwordHash ?? null
          : current.passwordHash
    });
  }

  private async routeRequest(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    const host = hostHeaderNormalize(request.headers.host ?? request.hostname ?? "");
    const route = this.routes.get(host);
    if (!route) {
      reply.status(404).send("Expose route not found.");
      return;
    }

    if (route.passwordHash) {
      const authorized = await authorizationCheck(
        request.headers.authorization,
        route.passwordHash
      );
      if (!authorized) {
        reply
          .status(401)
          .header("WWW-Authenticate", 'Basic realm="daycare"')
          .send("Unauthorized");
        return;
      }
    }

    await this.proxyRequest(request, reply, route.target);
  }

  private async proxyRequest(
    request: FastifyRequest,
    reply: FastifyReply,
    target: ExposeTarget
  ): Promise<void> {
    const headers: http.OutgoingHttpHeaders = { ...request.headers };
    delete headers.connection;

    const options: http.RequestOptions = {
      method: request.raw.method,
      path: request.raw.url,
      headers
    };

    if (target.type === "port") {
      options.hostname = "127.0.0.1";
      options.port = target.port;
    } else {
      options.socketPath = target.path;
    }

    reply.hijack();

    await new Promise<void>((resolve) => {
      let settled = false;
      const settle = () => {
        if (settled) {
          return;
        }
        settled = true;
        resolve();
      };

      const upstreamRequest = http.request(options, (upstreamResponse) => {
        const statusCode = upstreamResponse.statusCode ?? 502;
        reply.raw.writeHead(statusCode, upstreamResponse.headers);
        void pipeline(upstreamResponse, reply.raw)
          .catch(() => {
            // Socket errors are expected on abrupt disconnects.
          })
          .finally(settle);
      });

      upstreamRequest.on("error", () => {
        if (!reply.raw.headersSent) {
          reply.raw.statusCode = 502;
          reply.raw.setHeader("content-type", "text/plain; charset=utf-8");
          reply.raw.end("Expose upstream unavailable.");
        } else {
          reply.raw.destroy();
        }
        settle();
      });

      const parsedBody = request.body;
      if (Buffer.isBuffer(parsedBody)) {
        if (headers["content-length"] !== undefined) {
          upstreamRequest.setHeader("content-length", parsedBody.length);
        }
        upstreamRequest.end(parsedBody);
        return;
      }

      void pipeline(request.raw, upstreamRequest).catch(() => {
        upstreamRequest.destroy();
      });
    });
  }
}

function hostHeaderNormalize(value: string | string[]): string {
  const raw = Array.isArray(value) ? (value[0] ?? "") : value;
  const normalized = raw.trim().toLowerCase();
  if (!normalized) {
    return "";
  }
  if (normalized.startsWith("[")) {
    return normalized;
  }
  const split = normalized.split(":");
  return split[0] ?? normalized;
}

async function authorizationCheck(
  authorization: string | string[] | undefined,
  passwordHash: string
): Promise<boolean> {
  const value = Array.isArray(authorization)
    ? (authorization[0] ?? "")
    : (authorization ?? "");
  if (!value.startsWith("Basic ")) {
    return false;
  }

  const encoded = value.slice("Basic ".length).trim();
  if (!encoded) {
    return false;
  }

  let decoded = "";
  try {
    decoded = Buffer.from(encoded, "base64").toString("utf8");
  } catch {
    return false;
  }

  const separatorIndex = decoded.indexOf(":");
  if (separatorIndex <= 0) {
    return false;
  }
  const username = decoded.slice(0, separatorIndex);
  const password = decoded.slice(separatorIndex + 1);
  if (username !== "daycare") {
    return false;
  }

  return bcrypt.compare(password, passwordHash);
}
