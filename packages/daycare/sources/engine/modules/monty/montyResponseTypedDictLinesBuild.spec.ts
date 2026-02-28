import { describe, expect, it } from "vitest";

import { montyResponseTypedDictLinesBuild } from "./montyResponseTypedDictLinesBuild.js";

describe("montyResponseTypedDictLinesBuild", () => {
    it("builds typed dict lines with required and optional fields", () => {
        const lines = montyResponseTypedDictLinesBuild("ReadFileResponse", {
            type: "object",
            properties: {
                summary: { type: "string" },
                size: { type: "integer" }
            },
            required: ["summary"],
            additionalProperties: false
        });

        expect(lines.join("\n")).toBe(
            ['ReadFileResponse = TypedDict("ReadFileResponse", { "summary": str, "size": int })'].join("\n")
        );
    });

    it("builds nested typed dict lines for arrays of object rows", () => {
        const lines = montyResponseTypedDictLinesBuild("QueryResponse", {
            type: "object",
            properties: {
                rows: {
                    type: "array",
                    items: {
                        type: "object",
                        properties: {
                            id: { type: "integer" },
                            name: { type: "string" }
                        },
                        required: ["id"]
                    }
                }
            },
            required: ["rows"],
            additionalProperties: false
        });

        expect(lines.join("\n")).toBe(
            [
                'QueryResponseRowsItem = TypedDict("QueryResponseRowsItem", { "id": int, "name": str })',
                "",
                'QueryResponse = TypedDict("QueryResponse", { "rows": list[QueryResponseRowsItem] })'
            ].join("\n")
        );
    });

    it("builds nested typed dict lines for object properties", () => {
        const lines = montyResponseTypedDictLinesBuild("TopologyResponse", {
            type: "object",
            properties: {
                triggers: {
                    type: "object",
                    properties: {
                        cron: { type: "array", items: { type: "string" } },
                        enabled: { type: "boolean" }
                    },
                    required: ["cron"]
                }
            },
            required: ["triggers"],
            additionalProperties: false
        });

        expect(lines.join("\n")).toBe(
            [
                'TopologyResponseTriggers = TypedDict("TopologyResponseTriggers", { "cron": list[str], "enabled": bool })',
                "",
                'TopologyResponse = TypedDict("TopologyResponse", { "triggers": TopologyResponseTriggers })'
            ].join("\n")
        );
    });

    it("builds multiple typed dict lines for deeply nested object properties", () => {
        const lines = montyResponseTypedDictLinesBuild("DeepResponse", {
            type: "object",
            properties: {
                payload: {
                    type: "object",
                    properties: {
                        meta: {
                            type: "object",
                            properties: {
                                score: { type: "number" }
                            }
                        }
                    }
                }
            },
            additionalProperties: false
        });

        expect(lines.join("\n")).toBe(
            [
                'DeepResponsePayloadMeta = TypedDict("DeepResponsePayloadMeta", { "score": float })',
                "",
                'DeepResponsePayload = TypedDict("DeepResponsePayload", { "meta": DeepResponsePayloadMeta })',
                "",
                'DeepResponse = TypedDict("DeepResponse", { "payload": DeepResponsePayload })'
            ].join("\n")
        );
    });

    it("builds typed dict lines for mixed nested objects and arrays of nested objects", () => {
        const lines = montyResponseTypedDictLinesBuild("MixedResponse", {
            type: "object",
            properties: {
                stats: {
                    type: "object",
                    properties: {
                        totals: { type: "array", items: { type: "integer" } }
                    }
                },
                rows: {
                    type: "array",
                    items: {
                        type: "object",
                        properties: {
                            id: { type: "string" },
                            profile: {
                                type: "object",
                                properties: {
                                    active: { type: "boolean" }
                                }
                            }
                        }
                    }
                }
            },
            additionalProperties: false
        });

        expect(lines.join("\n")).toBe(
            [
                'MixedResponseStats = TypedDict("MixedResponseStats", { "totals": list[int] })',
                "",
                'MixedResponseRowsItemProfile = TypedDict("MixedResponseRowsItemProfile", { "active": bool })',
                "",
                'MixedResponseRowsItem = TypedDict("MixedResponseRowsItem", { "id": str, "profile": MixedResponseRowsItemProfile })',
                "",
                'MixedResponse = TypedDict("MixedResponse", { "stats": MixedResponseStats, "rows": list[MixedResponseRowsItem] })'
            ].join("\n")
        );
    });

    it("renders array of primitives on nested object properties as list hints", () => {
        const lines = montyResponseTypedDictLinesBuild("SecretResponse", {
            type: "object",
            properties: {
                secret: {
                    type: "object",
                    properties: {
                        variableNames: {
                            type: "array",
                            items: {
                                type: "string"
                            }
                        }
                    }
                }
            },
            additionalProperties: false
        });

        expect(lines.join("\n")).toBe(
            [
                'SecretResponseSecret = TypedDict("SecretResponseSecret", { "variableNames": list[str] })',
                "",
                'SecretResponse = TypedDict("SecretResponse", { "secret": SecretResponseSecret })'
            ].join("\n")
        );
    });
});
