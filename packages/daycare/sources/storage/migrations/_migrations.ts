import { migration20260226Bootstrap } from "./20260226_bootstrap.js";
import { migration20260227UserProfile } from "./20260227_user_profile.js";
import type { Migration } from "./migrationTypes.js";

export const migrations: Migration[] = [migration20260226Bootstrap, migration20260227UserProfile];
