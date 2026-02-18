import { promises as fs } from "node:fs";
import http from "node:http";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { pipeline } from "node:stream/promises";

import bcrypt from "bcryptjs";
import { z } from "zod";

import { resolveEngineSocketPath } from "../../engine/ipc/socket.js";
import { definePlugin } from "../../engine/plugins/types.js";

const DASHBOARD_DEFAULT_HOST = "127.0.0.1";
const DASHBOARD_DEFAULT_PORT = 7331;
const DASHBOARD_DEFAULT_USERNAME = "daycare";
const DASHBOARD_BASIC_AUTH_REALM = "Daycare Dashboard";

const siteDirectory = fileURLToPath(new URL("./site", import.meta.url));

const settingsSchema = z
  .object({
    host: z.string().trim().min(1).default(DASHBOARD_DEFAULT_HOST),
    port: z.coerce.number().int().min(1).max(65535).default(DASHBOARD_DEFAULT_PORT),
    basicAuth: z
      .object({
        username: z.string().trim().min(1).default(DASHBOARD_DEFAULT_USERNAME),
        passwordHash: z.string().min(1)
      })
      .strict()
      .optional()
  })
  .strict();

type DashboardSettings = z.infer<typeof settingsSchema>;

type DashboardAssets = {
  indexHtml: Buffer;
  styleCss: Buffer;
  appJs: Buffer;
};

export const plugin = definePlugin({
  settingsSchema,
  onboarding: async (api) => {
    const hostInput = await api.prompt.input({
      message: "Dashboard host",
      default: DASHBOARD_DEFAULT_HOST
    });
    if (hostInput === null) {
      return null;
    }

    const portInput = await api.prompt.input({
      message: "Dashboard port",
      default: String(DASHBOARD_DEFAULT_PORT)
    });
    if (portInput === null) {
      return null;
    }

    const host = hostInput.trim() || DASHBOARD_DEFAULT_HOST;
    let port: number;
    try {
      port = dashboardPortResolve(portInput);
    } catch (error) {
      api.note((error as Error).message, "Dashboard");
      return null;
    }

    const enableBasicAuth = await api.prompt.confirm({
      message: "Enable dashboard basic authentication?",
      default: true
    });

    if (enableBasicAuth === null) {
      return null;
    }

    if (enableBasicAuth !== true) {
      api.note(
        `Dashboard plugin enabled on http://${host}:${port} without authentication.`,
        "Dashboard"
      );
      return { settings: { host, port } };
    }

    const usernameInput = await api.prompt.input({
      message: "Dashboard username",
      default: DASHBOARD_DEFAULT_USERNAME
    });
    if (usernameInput === null) {
      return null;
    }

    const username = usernameInput.trim() || DASHBOARD_DEFAULT_USERNAME;
    const passwordMode = await api.prompt.select({
      message: "Dashboard password",
      choices: [
        {
          value: "generate",
          name: "Generate secure password",
          description: "Recommended. Daycare generates a random strong password."
        },
        {
          value: "provide",
          name: "Provide password",
          description: "Use your own strong password (12+ chars)."
        }
      ]
    });

    if (passwordMode === null) {
      return null;
    }

    const providedPassword =
      passwordMode === "generate"
        ? dashboardPasswordGenerate()
        : await dashboardPasswordPrompt(api.prompt.input);
    if (!providedPassword) {
      api.note("Dashboard setup cancelled.", "Dashboard");
      return null;
    }

    if (!dashboardPasswordIsStrong(providedPassword)) {
      api.note(
        "Password must be at least 12 characters and include uppercase, lowercase, and numeric characters.",
        "Dashboard"
      );
      return null;
    }

    const passwordHash = await bcrypt.hash(providedPassword, 10);

    if (passwordMode === "generate") {
      api.note(
        [
          `Dashboard URL: http://${host}:${port}`,
          `Username: ${username}`,
          `Password: ${providedPassword}`,
          "Save this password now. It is not shown again."
        ].join("\n"),
        "Dashboard"
      );
    } else {
      api.note(
        `Dashboard basic auth enabled for ${username} at http://${host}:${port}.`,
        "Dashboard"
      );
    }

    return {
      settings: {
        host,
        port,
        basicAuth: {
          username,
          passwordHash
        }
      }
    };
  },
  create: (api) => {
    const settings = api.settings as DashboardSettings;
    const socketPath = resolveEngineSocketPath(api.engineSettings.engine?.socketPath);
    const assetsPromise = dashboardAssetsLoad();

    let server: http.Server | null = null;

    const handleRequest = async (
      request: http.IncomingMessage,
      response: http.ServerResponse
    ): Promise<void> => {
      if (settings.basicAuth) {
        const authorized = await dashboardRequestIsAuthorized(
          request.headers.authorization,
          settings.basicAuth
        );
        if (!authorized) {
          dashboardRespondUnauthorized(response);
          return;
        }
      }

      const requestUrl = new URL(request.url ?? "/", `http://${settings.host}`);
      if (requestUrl.pathname.startsWith("/api/")) {
        await dashboardProxyRequest(request, response, socketPath, requestUrl);
        return;
      }

      const assets = await assetsPromise;
      dashboardServeAsset(response, requestUrl.pathname, assets);
    };

    return {
      load: async () => {
        await assetsPromise;

        server = http.createServer((request, response) => {
          void handleRequest(request, response).catch((error: unknown) => {
            api.logger.warn({ error }, "error: Dashboard request failed");
            if (response.headersSent) {
              response.destroy();
              return;
            }
            dashboardSendJson(response, 500, {
              ok: false,
              error: "Dashboard request failed."
            });
          });
        });

        await dashboardServerListen(server, settings.host, settings.port);
        const authMessage = settings.basicAuth
          ? `basic auth enabled (user: ${settings.basicAuth.username})`
          : "basic auth disabled";
        api.logger.info(
          { host: settings.host, port: settings.port },
          `Dashboard listening on http://${settings.host}:${settings.port} (${authMessage})`
        );
      },
      unload: async () => {
        if (!server) {
          return;
        }
        await dashboardServerClose(server);
        server = null;
      }
    };
  }
});

function dashboardPortResolve(input: string): number {
  const raw = input.trim();
  if (!raw) {
    return DASHBOARD_DEFAULT_PORT;
  }
  const port = Number(raw);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("Dashboard port must be an integer between 1 and 65535.");
  }
  return port;
}

function dashboardPasswordGenerate(): string {
  return randomBytes(18).toString("base64url");
}

async function dashboardPasswordPrompt(
  input: (config: { message: string; default?: string; placeholder?: string }) => Promise<string | null>
): Promise<string | null> {
  const provided = await input({
    message: "Dashboard password (12+ chars, include upper/lower/number)"
  });
  if (provided === null) {
    return null;
  }
  return provided.trim();
}

function dashboardPasswordIsStrong(password: string): boolean {
  if (password.length < 12) {
    return false;
  }
  const hasLower = /[a-z]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasDigit = /[0-9]/.test(password);
  return hasLower && hasUpper && hasDigit;
}

async function dashboardAssetsLoad(): Promise<DashboardAssets> {
  const [indexHtml, styleCss, appJs] = await Promise.all([
    fs.readFile(path.join(siteDirectory, "index.html")),
    fs.readFile(path.join(siteDirectory, "dashboard.css")),
    fs.readFile(path.join(siteDirectory, "dashboard.js"))
  ]);

  return {
    indexHtml,
    styleCss,
    appJs
  };
}

function dashboardServeAsset(
  response: http.ServerResponse,
  pathname: string,
  assets: DashboardAssets
): void {
  if (pathname === "/" || pathname === "/index.html") {
    dashboardSendBytes(response, 200, "text/html; charset=utf-8", assets.indexHtml);
    return;
  }

  if (pathname === "/dashboard.css") {
    dashboardSendBytes(response, 200, "text/css; charset=utf-8", assets.styleCss);
    return;
  }

  if (pathname === "/dashboard.js") {
    dashboardSendBytes(response, 200, "application/javascript; charset=utf-8", assets.appJs);
    return;
  }

  if (pathname === "/favicon.ico") {
    response.writeHead(204);
    response.end();
    return;
  }

  dashboardSendBytes(response, 200, "text/html; charset=utf-8", assets.indexHtml);
}

async function dashboardProxyRequest(
  request: http.IncomingMessage,
  response: http.ServerResponse,
  socketPath: string,
  url: URL
): Promise<void> {
  const headers = { ...request.headers };
  delete headers.host;
  delete headers.connection;

  const upstreamPath = `${url.pathname}${url.search}`;

  await new Promise<void>((resolve) => {
    const upstream = http.request(
      {
        socketPath,
        path: upstreamPath,
        method: request.method,
        headers
      },
      (upstreamResponse) => {
        response.writeHead(upstreamResponse.statusCode ?? 502, upstreamResponse.headers);
        // Preserve SSE/streaming responses by piping byte-for-byte.
        void pipeline(upstreamResponse, response)
          .then(() => resolve())
          .catch(() => {
            response.destroy();
            resolve();
          });
      }
    );

    upstream.on("error", (error) => {
      dashboardSendJson(response, 502, {
        ok: false,
        error: `Dashboard proxy failed: ${error.message}`
      });
      resolve();
    });

    if (request.method === "GET" || request.method === "HEAD") {
      upstream.end();
      return;
    }

    void pipeline(request, upstream).catch(() => {
      upstream.destroy();
    });
  });
}

async function dashboardRequestIsAuthorized(
  authorizationHeader: string | undefined,
  config: { username: string; passwordHash: string }
): Promise<boolean> {
  if (!authorizationHeader) {
    return false;
  }

  const [scheme, payload] = authorizationHeader.split(" ");
  if (!scheme || !payload || scheme.toLowerCase() !== "basic") {
    return false;
  }

  let decoded = "";
  try {
    decoded = Buffer.from(payload, "base64").toString("utf8");
  } catch {
    return false;
  }

  const separatorIndex = decoded.indexOf(":");
  if (separatorIndex <= 0) {
    return false;
  }

  const username = decoded.slice(0, separatorIndex);
  const password = decoded.slice(separatorIndex + 1);

  if (username !== config.username) {
    return false;
  }

  return bcrypt.compare(password, config.passwordHash);
}

function dashboardRespondUnauthorized(response: http.ServerResponse): void {
  response.writeHead(401, {
    "www-authenticate": `Basic realm="${DASHBOARD_BASIC_AUTH_REALM}"`,
    "content-type": "application/json; charset=utf-8"
  });
  response.end('{"ok":false,"error":"Unauthorized"}');
}

function dashboardSendJson(
  response: http.ServerResponse,
  statusCode: number,
  payload: Record<string, unknown>
): void {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  });
  response.end(`${JSON.stringify(payload)}\n`);
}

function dashboardSendBytes(
  response: http.ServerResponse,
  statusCode: number,
  contentType: string,
  body: Buffer
): void {
  response.writeHead(statusCode, {
    "content-type": contentType,
    "cache-control": "no-store"
  });
  response.end(body);
}

function dashboardServerListen(server: http.Server, host: string, port: number): Promise<void> {
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

function dashboardServerClose(server: http.Server): Promise<void> {
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
