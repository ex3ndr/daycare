export type RecipeFile = {
  id: string;
  path: string;
  description: string;
};

/**
 * Lists runnable TypeScript recipe entry files.
 * Expects: each path can be executed directly with `tsx`.
 */
export const RECIPE_FILES: readonly RecipeFile[] = [
  {
    id: "anthropic-manual-loop",
    path: "sources/recipe/recipeAnthropicManualLoop.ts",
    description: "Manual agent loop using Anthropic OAuth credentials from ~/.dev/auth.json."
  }
];
