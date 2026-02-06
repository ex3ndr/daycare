import { Type, type Static } from "@sinclair/typebox";
import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { z } from "zod";

import { definePlugin } from "../../engine/plugins/types.js";
import { stringTruncate } from "../../utils/stringTruncate.js";

const settingsSchema = z
  .object({
    toolName: z.string().min(1).optional()
  })
  .passthrough();

const fetchSchema = Type.Object(
  {
    url: Type.String({ minLength: 1, description: "The URL to fetch content from" }),
    maxChars: Type.Optional(
      Type.Number({ minimum: 100, maximum: 200000, description: "Max characters to return" })
    ),
    timeoutMs: Type.Optional(
      Type.Number({ minimum: 1000, maximum: 30000, description: "Request timeout in ms" })
    )
  },
  { additionalProperties: false }
);

type FetchArgs = Static<typeof fetchSchema>;

export const plugin = definePlugin({
  settingsSchema,
  create: (api) => {
    const toolName = api.settings.toolName ?? "web_fetch";

    return {
      load: async () => {
        api.registrar.registerTool({
          tool: {
            name: toolName,
            description:
              "Fetch web page content with a plain HTTP request (no JavaScript rendering).",
            parameters: fetchSchema
          },
          execute: async (args, toolContext, toolCall) => {
            if (!toolContext.permissions.network) {
              throw new Error("Network access not granted. Request @network permission.");
            }
            const payload = args as FetchArgs;
            const maxChars = payload.maxChars ?? 20000;
            const timeoutMs = payload.timeoutMs ?? 15000;

            let parsedUrl: URL;
            try {
              parsedUrl = new URL(payload.url);
            } catch (error) {
              const message = error instanceof Error ? error.message : "Invalid URL";
              throw new Error(`Web fetch failed: ${message}`);
            }
            if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
              throw new Error("Web fetch only supports http and https URLs.");
            }

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
            let response: Response;

            try {
              response = await fetch(parsedUrl.toString(), {
                signal: controller.signal,
                headers: {
                  "User-Agent": "Daycare/1.0",
                  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
                }
              });
            } catch (error) {
              const message = error instanceof Error ? error.message : "Request failed";
              throw new Error(`Web fetch failed: ${message}`);
            } finally {
              clearTimeout(timeoutId);
            }

            if (!response.ok) {
              const errorText = stringTruncate(await response.text(), 500);
              const detail = errorText ? ` - ${errorText}` : "";
              throw new Error(`Web fetch failed: ${response.status} ${response.statusText}${detail}`);
            }

            const contentType = response.headers.get("content-type") ?? "unknown";
            const content = stringTruncate(await response.text(), maxChars);

            const text = [
              `Status: ${response.status} ${response.statusText}`.trim(),
              `Content-Type: ${contentType}`,
              `URL: ${parsedUrl.toString()}`,
              "",
              "---",
              "",
              content || "No content returned."
            ].join("\n");

            const toolMessage: ToolResultMessage = {
              role: "toolResult",
              toolCallId: toolCall.id,
              toolName: toolCall.name,
              content: [{ type: "text", text }],
              details: { url: parsedUrl.toString(), contentType, status: response.status },
              isError: false,
              timestamp: Date.now()
            };

            return { toolMessage, files: [] };
          }
        });
      },
      unload: async () => {
        api.registrar.unregisterTool(toolName);
      }
    };
  }
});
