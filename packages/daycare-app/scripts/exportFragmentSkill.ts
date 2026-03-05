import { execSync } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fragmentsCatalog } from "../sources/fragments/catalog";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const templatePath = path.resolve(scriptDir, "../../daycare/sources/prompts/SKILL_TEMPLATE.md");
const skillOutputPath = path.resolve(scriptDir, "../../daycare/sources/skills/create-fragment/SKILL.md");
const schemaOutputPath = path.resolve(scriptDir, "../../daycare/sources/fragments/_fragmentSchema.ts");

interface ComponentMeta {
    props: string[];
    slots: string[];
}

async function exportSkill(): Promise<void> {
    const template = await fs.readFile(templatePath, "utf8");
    const catalogPrompt = fragmentsCatalog.prompt();
    const content = `${template.trimEnd()}\n\n${catalogPrompt.trimStart()}\n`;

    await fs.mkdir(path.dirname(skillOutputPath), { recursive: true });
    await fs.writeFile(skillOutputPath, content, "utf8");
    console.log(`exported fragment skill: ${skillOutputPath}`);
}

async function exportSchema(): Promise<void> {
    const meta: Record<string, ComponentMeta> = {};

    for (const name of fragmentsCatalog.componentNames) {
        const comp = (fragmentsCatalog.data as Record<string, Record<string, unknown>>).components[
            name
        ] as unknown as { props: { shape?: Record<string, unknown> }; slots: string[] };
        const propKeys = Object.keys(comp.props.shape ?? {});
        meta[name] = { props: propKeys, slots: comp.slots ?? [] };
    }

    const lines = [
        "// @generated — do not edit manually. Run: yarn workspace daycare-app export:fragment-skill",
        "",
        `export const fragmentSchema = ${JSON.stringify(meta, null, 4)} as const;`,
        ""
    ];

    await fs.mkdir(path.dirname(schemaOutputPath), { recursive: true });
    await fs.writeFile(schemaOutputPath, lines.join("\n"), "utf8");
    console.log(`exported fragment schema: ${schemaOutputPath}`);
}

async function main(): Promise<void> {
    await Promise.all([exportSkill(), exportSchema()]);
    // Format generated TS file to match biome style
    execSync(`npx biome check --write ${schemaOutputPath}`, { stdio: "ignore" });
}

main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
});
