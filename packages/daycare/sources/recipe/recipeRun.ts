import { RECIPE_FILES } from "./_recipes.js";

/**
 * Runs a named recipe by delegating to its exported async `main(args)` function.
 * Expects: first arg is a known recipe id from RECIPE_FILES.
 */
export async function main(args: string[]): Promise<void> {
    const recipeId = args[0]?.trim();
    if (!recipeId) {
        recipeUsagePrint();
        process.exitCode = 1;
        return;
    }

    const recipe = RECIPE_FILES.find((item) => item.id === recipeId);
    if (!recipe) {
        console.error(`Unknown recipe: ${recipeId}`);
        recipeUsagePrint();
        process.exitCode = 1;
        return;
    }

    await recipe.main(args.slice(1));
}

function recipeUsagePrint(): void {
    console.log("Usage: yarn recipe <name> [args]");
    console.log("");
    console.log("Available recipes:");
    for (const recipe of RECIPE_FILES) {
        console.log(`- ${recipe.id}: ${recipe.description}`);
    }
}

await main(process.argv.slice(2));
