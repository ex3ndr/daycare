import { describe, expect, it } from "vitest";
import { MINI_APP_TOOL_ALLOWLIST } from "./miniAppToolAllowlist.js";

describe("MINI_APP_TOOL_ALLOWLIST", () => {
    it("contains expected read-only tools", () => {
        expect(MINI_APP_TOOL_ALLOWLIST.has("read")).toBe(true);
        expect(MINI_APP_TOOL_ALLOWLIST.has("read_json")).toBe(true);
        expect(MINI_APP_TOOL_ALLOWLIST.has("exec")).toBe(true);
        expect(MINI_APP_TOOL_ALLOWLIST.has("psql_query")).toBe(true);
        expect(MINI_APP_TOOL_ALLOWLIST.has("psql_db_list")).toBe(true);
        expect(MINI_APP_TOOL_ALLOWLIST.has("document_read")).toBe(true);
        expect(MINI_APP_TOOL_ALLOWLIST.has("todo_list")).toBe(true);
        expect(MINI_APP_TOOL_ALLOWLIST.has("exa_search")).toBe(true);
        expect(MINI_APP_TOOL_ALLOWLIST.has("json_parse")).toBe(true);
        expect(MINI_APP_TOOL_ALLOWLIST.has("json_stringify")).toBe(true);
        expect(MINI_APP_TOOL_ALLOWLIST.has("observation_query")).toBe(true);
        expect(MINI_APP_TOOL_ALLOWLIST.has("signal_events_csv")).toBe(true);
    });

    it("excludes write tools", () => {
        expect(MINI_APP_TOOL_ALLOWLIST.has("write")).toBe(false);
        expect(MINI_APP_TOOL_ALLOWLIST.has("edit")).toBe(false);
        expect(MINI_APP_TOOL_ALLOWLIST.has("write_output")).toBe(false);
        expect(MINI_APP_TOOL_ALLOWLIST.has("document_write")).toBe(false);
        expect(MINI_APP_TOOL_ALLOWLIST.has("document_append")).toBe(false);
        expect(MINI_APP_TOOL_ALLOWLIST.has("document_patch")).toBe(false);
    });

    it("excludes agent control tools", () => {
        expect(MINI_APP_TOOL_ALLOWLIST.has("start_background_agent")).toBe(false);
        expect(MINI_APP_TOOL_ALLOWLIST.has("send_agent_message")).toBe(false);
        expect(MINI_APP_TOOL_ALLOWLIST.has("agent_reset")).toBe(false);
        expect(MINI_APP_TOOL_ALLOWLIST.has("agent_compact")).toBe(false);
    });

    it("excludes task and scheduling tools", () => {
        expect(MINI_APP_TOOL_ALLOWLIST.has("task_create")).toBe(false);
        expect(MINI_APP_TOOL_ALLOWLIST.has("task_run")).toBe(false);
        expect(MINI_APP_TOOL_ALLOWLIST.has("task_trigger_add")).toBe(false);
    });
});
