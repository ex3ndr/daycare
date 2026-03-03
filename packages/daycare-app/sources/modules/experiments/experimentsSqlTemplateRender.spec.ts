import { describe, expect, it } from "vitest";
import { experimentsSqlTemplateRender } from "./experimentsSqlTemplateRender";

describe("experimentsSqlTemplateRender", () => {
    it("renders sql literals with escaping", () => {
        const sql = experimentsSqlTemplateRender(
            "INSERT INTO t(title, active) VALUES ({{sql params.title}}, {{sql params.active}});",
            {
                state: {},
                params: {
                    title: "O'Reilly",
                    active: true
                },
                runtime: {
                    now: 1,
                    generatedId: "id-1"
                }
            }
        );

        expect(sql).toContain("'O''Reilly'");
        expect(sql).toContain("TRUE");
    });

    it("throws when value is non-scalar object", () => {
        expect(() =>
            experimentsSqlTemplateRender("SELECT * FROM t WHERE id = {{sql params.id}};", {
                state: {},
                params: {
                    id: { nested: true }
                },
                runtime: {
                    now: 1,
                    generatedId: "id-1"
                }
            })
        ).toThrow("SQL template value must be scalar.");
    });
});
