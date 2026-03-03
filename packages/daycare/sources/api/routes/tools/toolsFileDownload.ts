import type { Tool } from "@mariozechner/pi-ai";

export type ToolsFileDownloadInput = {
    toolName: string;
    tools: {
        list: () => Tool[];
    };
};

export type ToolsFileDownloadResult =
    | {
          ok: true;
          file: {
              path: "definition.json";
              size: number;
              updatedAt: null;
              mimeType: "application/json";
              filename: string;
          };
          content: Buffer;
      }
    | {
          ok: false;
          statusCode: number;
          error: string;
      };

/**
 * Builds a downloadable JSON definition file for one tool.
 * Expects: toolName is a non-empty tool id from the current runtime.
 */
export function toolsFileDownload(input: ToolsFileDownloadInput): ToolsFileDownloadResult {
    const normalizedToolName = input.toolName.trim();
    if (!normalizedToolName) {
        return { ok: false, statusCode: 400, error: "toolName is required." };
    }

    const tool = input.tools.list().find((entry) => entry.name === normalizedToolName);
    if (!tool) {
        return { ok: false, statusCode: 404, error: "Tool not found." };
    }

    const content = Buffer.from(`${toolDefinitionSerialize(tool)}\n`, "utf8");
    return {
        ok: true,
        file: {
            path: "definition.json",
            size: content.length,
            updatedAt: null,
            mimeType: "application/json",
            filename: `${tool.name}.definition.json`
        },
        content
    };
}

function toolDefinitionSerialize(tool: Tool): string {
    return JSON.stringify(
        {
            name: tool.name,
            description: tool.description ?? null,
            parameters: tool.parameters ?? null
        },
        null,
        2
    );
}
