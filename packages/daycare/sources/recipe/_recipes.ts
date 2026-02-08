import { main as recipeRlmMain } from "./recipeRlm.js";
import { main as recipePyreplMain } from "./recipePyrepl.js";

export type RecipeMain = (args: string[]) => Promise<void>;

export type RecipeFile = {
  id: string;
  path: string;
  description: string;
  main: RecipeMain;
};

/**
 * Lists runnable TypeScript recipe entries.
 * Expects: each entry exports `main(args)` and maps to a source file path.
 */
export const RECIPE_FILES: readonly RecipeFile[] = [
  {
    id: "rlm",
    path: "sources/recipe/recipeRlm.ts",
    description: "Dead-simple Anthropic recipe loop with prompts and pi-ai inference.",
    main: recipeRlmMain
  },
  {
    id: "pyrepl",
    path: "sources/recipe/recipePyrepl.ts",
    description: "Sequential inference loop with tool-only Python REPL execution.",
    main: recipePyreplMain
  }
];
