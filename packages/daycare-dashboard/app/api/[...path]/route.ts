import http from "node:http";
import { Readable } from "node:stream";
import type { NextRequest } from "next/server";
import { resolveSocketPath } from "@/lib/engine-socket";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteParams = {
  path?: string[];
};

async function proxyRequest(request: NextRequest, params: RouteParams) {
  const socketPath = await resolveSocketPath();
  const url = new URL(request.url);
  const upstreamPath = `/${params.path?.join("/") ?? ""}${url.search}`;

  const headers: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    if (key.toLowerCase() === "host") {
      return;
    }
    headers[key] = value;
  });

  let body: Buffer | undefined;
  if (!/^(GET|HEAD)$/i.test(request.method)) {
    const arrayBuffer = await request.arrayBuffer();
    body = Buffer.from(arrayBuffer);
    if (body.length > 0) {
      headers["content-length"] = String(body.length);
    }
  }

  return await new Promise<Response>((resolve) => {
    const proxy = http.request(
      {
        socketPath,
        path: upstreamPath,
        method: request.method,
        headers
      },
      (proxyRes) => {
        const stream = Readable.toWeb(proxyRes) as BodyInit;
        resolve(
          new Response(stream, {
            status: proxyRes.statusCode ?? 502,
            headers: proxyRes.headers as HeadersInit
          })
        );
      }
    );

    proxy.on("error", (error) => {
      resolve(new Response(`Proxy error: ${error.message}`, { status: 502 }));
    });

    if (body && body.length > 0) {
      proxy.write(body);
    }

    proxy.end();
  });
}

export async function GET(request: NextRequest, context: { params: RouteParams }) {
  return proxyRequest(request, context.params);
}

export async function POST(request: NextRequest, context: { params: RouteParams }) {
  return proxyRequest(request, context.params);
}

export async function PUT(request: NextRequest, context: { params: RouteParams }) {
  return proxyRequest(request, context.params);
}

export async function PATCH(request: NextRequest, context: { params: RouteParams }) {
  return proxyRequest(request, context.params);
}

export async function DELETE(request: NextRequest, context: { params: RouteParams }) {
  return proxyRequest(request, context.params);
}

export async function OPTIONS(request: NextRequest, context: { params: RouteParams }) {
  return proxyRequest(request, context.params);
}
