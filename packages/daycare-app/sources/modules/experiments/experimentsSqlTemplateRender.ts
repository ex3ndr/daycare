import type { StateModel } from "@json-render/core";
import Handlebars from "handlebars";

type ExperimentsSqlTemplateContext = {
    state: StateModel;
    params: Record<string, unknown>;
    runtime: {
        now: number;
        generatedId: string;
    };
};

const handlebars = Handlebars.create();
const templateCache = new Map<string, Handlebars.TemplateDelegate<ExperimentsSqlTemplateContext>>();

handlebars.registerHelper("sql", (value: unknown) => {
    if (value === null || value === undefined) {
        return "NULL";
    }
    if (typeof value === "boolean") {
        return value ? "TRUE" : "FALSE";
    }
    if (typeof value === "number") {
        return Number.isFinite(value) ? String(value) : "NULL";
    }
    if (typeof value === "bigint") {
        return value.toString();
    }
    if (typeof value === "object") {
        throw new Error("SQL template value must be scalar.");
    }

    const text = String(value).replace(/'/g, "''");
    return `'${text}'`;
});

/**
 * Renders a SQL template with Handlebars using state and action params.
 * Expects: all dynamic values in SQL use the `{{sql ...}}` helper.
 */
export function experimentsSqlTemplateRender(template: string, context: ExperimentsSqlTemplateContext): string {
    let compiled = templateCache.get(template);
    if (!compiled) {
        compiled = handlebars.compile<ExperimentsSqlTemplateContext>(template, { noEscape: true });
        templateCache.set(template, compiled);
    }
    return compiled(context).trim();
}
