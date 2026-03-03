import type { Tool } from "@mariozechner/pi-ai";

export type ToolsListInput = {
    tools: {
        list: () => Tool[];
    };
};

export type ToolsListResult = {
    ok: true;
    tools: Array<{
        name: string;
        description: string | null;
        parameters: unknown;
        files: Array<{
            path: string;
            size: number;
            updatedAt: null;
            download: {
                method: "GET";
                path: string;
            };
        }>;
    }>;
};

/**
 * Lists available tools and exposes a downloadable JSON definition per tool.
 * Expects: tools.list() returns serializable tool definitions.
 */
export function toolsList(input: ToolsListInput): ToolsListResult {
    const listed = input.tools.list();
    return {
        ok: true,
        tools: listed.map((tool) => {
            const definition = toolDefinitionSerialize(tool);
            return {
                name: tool.name,
                description: tool.description ?? null,
                parameters: tool.parameters ?? null,
                files: [
                    {
                        path: "definition.json",
                        size: Buffer.byteLength(definition, "utf8"),
                        updatedAt: null,
                        download: {
                            method: "GET",
                            path: `/tools/${encodeURIComponent(tool.name)}/download`
                        }
                    }
                ]
            };
        })
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
