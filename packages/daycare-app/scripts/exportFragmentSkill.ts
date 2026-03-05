import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fragmentsCatalog } from "../sources/fragments/catalog";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const templatePath = path.resolve(scriptDir, "../../daycare/sources/prompts/SKILL_TEMPLATE.md");
const outputPath = path.resolve(scriptDir, "../../daycare/sources/skills/create-fragment/SKILL.md");

async function main(): Promise<void> {
    const template = await fs.readFile(templatePath, "utf8");
    const catalogPrompt = fragmentsCatalog.prompt();
    const content = `${template.trimEnd()}\n\n${catalogPrompt.trimStart()}\n`;

    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, content, "utf8");
    console.log(`exported fragment skill: ${outputPath}`);
}

main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
});
