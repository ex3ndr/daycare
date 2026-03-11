import { describe, expect, it, vi } from "vitest";
import type { Context } from "@/types";
import type { FragmentsRepository } from "../../../storage/fragmentsRepository.js";
import type { PsqlService } from "../../../services/psql/PsqlService.js";
import type { TodosRepository } from "../../../storage/todosRepository.js";
import type { DocumentsRepository } from "../../../storage/documentsRepository.js";
import { fragmentsCallTool, type FragmentToolServices } from "./fragmentsCallTool.js";

function mockContext(userId = "test-user"): Context {
    return { userId } as Context;
}

function mockFragmentsRepository(fragment: { id: string; userId: string } | null): FragmentsRepository {
    return {
        findAnyById: vi.fn().mockResolvedValue(fragment)
    } as unknown as FragmentsRepository;
}

function mockEmptyServices(): FragmentToolServices {
    return {
        psql: null,
        todos: null,
        documents: null
    };
}

describe("fragmentsCallTool", () => {
    it("returns error when fragmentId is empty", async () => {
        const result = await fragmentsCallTool({
            ctx: mockContext(),
            fragmentId: "",
            tool: "psql_query",
            args: {},
            fragments: mockFragmentsRepository(null),
            services: mockEmptyServices()
        });

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error).toBe("fragmentId is required.");
        }
    });

    it("returns error when tool is empty", async () => {
        const result = await fragmentsCallTool({
            ctx: mockContext(),
            fragmentId: "frag-123",
            tool: "",
            args: {},
            fragments: mockFragmentsRepository({ id: "frag-123", userId: "test-user" }),
            services: mockEmptyServices()
        });

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error).toBe("tool is required.");
        }
    });

    it("returns error for non-allowed tool", async () => {
        const result = await fragmentsCallTool({
            ctx: mockContext(),
            fragmentId: "frag-123",
            tool: "write",
            args: {},
            fragments: mockFragmentsRepository({ id: "frag-123", userId: "test-user" }),
            services: mockEmptyServices()
        });

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error).toContain("not allowed");
            expect(result.error).toContain("write");
        }
    });

    it("returns error when fragment not found", async () => {
        const result = await fragmentsCallTool({
            ctx: mockContext(),
            fragmentId: "missing-frag",
            tool: "json_parse",
            args: { text: "{}" },
            fragments: mockFragmentsRepository(null),
            services: mockEmptyServices()
        });

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error).toBe("Fragment not found.");
        }
    });

    it("executes json_parse successfully", async () => {
        const result = await fragmentsCallTool({
            ctx: mockContext(),
            fragmentId: "frag-123",
            tool: "json_parse",
            args: { text: '{"key":"value"}' },
            fragments: mockFragmentsRepository({ id: "frag-123", userId: "test-user" }),
            services: mockEmptyServices()
        });

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.result).toEqual({ value: { key: "value" } });
        }
    });

    it("executes json_stringify successfully", async () => {
        const result = await fragmentsCallTool({
            ctx: mockContext(),
            fragmentId: "frag-123",
            tool: "json_stringify",
            args: { value: { key: "value" }, pretty: false },
            fragments: mockFragmentsRepository({ id: "frag-123", userId: "test-user" }),
            services: mockEmptyServices()
        });

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.result).toEqual({ value: '{"key":"value"}' });
        }
    });

    it("executes json_stringify with pretty printing", async () => {
        const result = await fragmentsCallTool({
            ctx: mockContext(),
            fragmentId: "frag-123",
            tool: "json_stringify",
            args: { value: { a: 1 }, pretty: true },
            fragments: mockFragmentsRepository({ id: "frag-123", userId: "test-user" }),
            services: mockEmptyServices()
        });

        expect(result.ok).toBe(true);
        if (result.ok) {
            const value = (result.result as { value: string }).value;
            expect(value).toContain("\n");
        }
    });

    it("executes psql_db_list when service available", async () => {
        const mockPsql: Partial<PsqlService> = {
            listDatabases: vi.fn().mockResolvedValue([
                { id: "db-1", name: "test-db", userId: "test-user", createdAt: 1000 }
            ])
        };

        const result = await fragmentsCallTool({
            ctx: mockContext(),
            fragmentId: "frag-123",
            tool: "psql_db_list",
            args: {},
            fragments: mockFragmentsRepository({ id: "frag-123", userId: "test-user" }),
            services: {
                psql: mockPsql as PsqlService,
                todos: null,
                documents: null
            }
        });

        expect(result.ok).toBe(true);
        if (result.ok) {
            const databases = (result.result as { databases: unknown[] }).databases;
            expect(databases).toHaveLength(1);
        }
    });

    it("returns error when psql service unavailable for psql_query", async () => {
        const result = await fragmentsCallTool({
            ctx: mockContext(),
            fragmentId: "frag-123",
            tool: "psql_query",
            args: { dbId: "db-1", sql: "SELECT 1" },
            fragments: mockFragmentsRepository({ id: "frag-123", userId: "test-user" }),
            services: mockEmptyServices()
        });

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error).toContain("unavailable");
        }
    });

    it("executes psql_query when service available", async () => {
        const mockPsql: Partial<PsqlService> = {
            query: vi.fn().mockResolvedValue([{ id: 1, name: "test" }])
        };

        const result = await fragmentsCallTool({
            ctx: mockContext(),
            fragmentId: "frag-123",
            tool: "psql_query",
            args: { dbId: "db-1", sql: "SELECT * FROM test", params: [] },
            fragments: mockFragmentsRepository({ id: "frag-123", userId: "test-user" }),
            services: {
                psql: mockPsql as PsqlService,
                todos: null,
                documents: null
            }
        });

        expect(result.ok).toBe(true);
        if (result.ok) {
            const rows = (result.result as { rows: unknown[] }).rows;
            expect(rows).toHaveLength(1);
        }
    });

    it("executes todo_list when service available", async () => {
        const mockTodos: Partial<TodosRepository> = {
            findTree: vi.fn().mockResolvedValue([
                { id: "todo-1", title: "Test Todo", status: "unstarted", parentId: null, position: 0 }
            ])
        };

        const result = await fragmentsCallTool({
            ctx: mockContext(),
            fragmentId: "frag-123",
            tool: "todo_list",
            args: {},
            fragments: mockFragmentsRepository({ id: "frag-123", userId: "test-user" }),
            services: {
                psql: null,
                todos: mockTodos as TodosRepository,
                documents: null
            }
        });

        expect(result.ok).toBe(true);
        if (result.ok) {
            const todoResult = result.result as { summary: string; todoCount: number };
            expect(todoResult.todoCount).toBe(1);
            expect(todoResult.summary).toContain("Test Todo");
        }
    });

    it("executes document_read for root listing when service available", async () => {
        const mockDocs: Partial<DocumentsRepository> = {
            findRoots: vi.fn().mockResolvedValue([
                { id: "doc-1", slug: "test-doc", title: "Test Document", description: "A test" }
            ])
        };

        const result = await fragmentsCallTool({
            ctx: mockContext(),
            fragmentId: "frag-123",
            tool: "document_read",
            args: {},
            fragments: mockFragmentsRepository({ id: "frag-123", userId: "test-user" }),
            services: {
                psql: null,
                todos: null,
                documents: mockDocs as DocumentsRepository
            }
        });

        expect(result.ok).toBe(true);
        if (result.ok) {
            const docResult = result.result as { found: boolean; documents: unknown[] };
            expect(docResult.found).toBe(true);
            expect(docResult.documents).toHaveLength(1);
        }
    });

    it("executes document_read by path when service available", async () => {
        const mockDocs: Partial<DocumentsRepository> = {
            findBySlugPath: vi.fn().mockResolvedValue({
                id: "doc-1",
                slug: "test",
                title: "Test",
                description: "Desc",
                body: "Body content",
                version: 1
            })
        };

        const result = await fragmentsCallTool({
            ctx: mockContext(),
            fragmentId: "frag-123",
            tool: "document_read",
            args: { path: "doc://memory/test" },
            fragments: mockFragmentsRepository({ id: "frag-123", userId: "test-user" }),
            services: {
                psql: null,
                todos: null,
                documents: mockDocs as DocumentsRepository
            }
        });

        expect(result.ok).toBe(true);
        if (result.ok) {
            const docResult = result.result as { found: boolean; document: { body: string } };
            expect(docResult.found).toBe(true);
            expect(docResult.document.body).toBe("Body content");
        }
    });
});
