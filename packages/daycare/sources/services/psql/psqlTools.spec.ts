import { validateToolCall } from "@mariozechner/pi-ai";
import { describe, expect, it } from "vitest";
import { psqlToolsBuild } from "./psqlTools.js";

describe("psqlTools schemas", () => {
    const tools = psqlToolsBuild({} as never).map((entry) => entry.tool);

    it("validates create/list payloads", () => {
        expect(
            validateToolCall(tools, {
                type: "toolCall",
                id: "1",
                name: "psql_db_create",
                arguments: { name: "CRM" }
            })
        ).toEqual({ name: "CRM" });

        expect(() =>
            validateToolCall(tools, {
                type: "toolCall",
                id: "2",
                name: "psql_db_create",
                arguments: {}
            })
        ).toThrow();

        expect(
            validateToolCall(tools, {
                type: "toolCall",
                id: "3",
                name: "psql_db_list",
                arguments: {}
            })
        ).toEqual({});
    });

    it("validates schema and data payload unions", () => {
        expect(
            validateToolCall(tools, {
                type: "toolCall",
                id: "4",
                name: "psql_schema",
                arguments: {
                    dbId: "db1",
                    table: "contacts",
                    comment: "Contact records",
                    fields: [{ name: "first_name", comment: "Given name", type: "text" }]
                }
            })
        ).toEqual({
            dbId: "db1",
            table: "contacts",
            comment: "Contact records",
            fields: [{ name: "first_name", comment: "Given name", type: "text" }]
        });

        expect(
            validateToolCall(tools, {
                type: "toolCall",
                id: "5",
                name: "psql_data",
                arguments: {
                    dbId: "db1",
                    op: { op: "update", table: "contacts", id: "row1", data: { age: 37 } }
                }
            })
        ).toEqual({
            dbId: "db1",
            op: { op: "update", table: "contacts", id: "row1", data: { age: 37 } }
        });

        expect(() =>
            validateToolCall(tools, {
                type: "toolCall",
                id: "6",
                name: "psql_data",
                arguments: {
                    dbId: "db1",
                    op: { op: "update", table: "contacts", data: { age: 37 } }
                }
            })
        ).toThrow();
    });

    it("validates query payload", () => {
        expect(
            validateToolCall(tools, {
                type: "toolCall",
                id: "7",
                name: "psql_query",
                arguments: {
                    dbId: "db1",
                    sql: "SELECT 1",
                    params: []
                }
            })
        ).toEqual({ dbId: "db1", sql: "SELECT 1", params: [] });

        expect(() =>
            validateToolCall(tools, {
                type: "toolCall",
                id: "8",
                name: "psql_query",
                arguments: {
                    dbId: "db1"
                }
            })
        ).toThrow();
    });
});
