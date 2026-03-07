import { getLogger } from "../log.js";
import type { ModelSelectionConfig } from "../settings.js";
import type {
    ModelRoleRuleCreateInput,
    ModelRoleRuleDbRecord,
    ModelRoleRulesRepository,
    ModelRoleRuleUpdateInput
} from "../storage/modelRoleRulesRepository.js";

const logger = getLogger("providers.model-roles");

/**
 * Context passed to resolve() for rule matching.
 * All fields are used as match candidates against rule matchers.
 */
export type ModelRoleResolveContext = {
    role: string | null;
    kind: string | null;
    userId: string;
    agentId: string;
};

export type ModelRolesOptions = {
    repository: ModelRoleRulesRepository;
};

/**
 * Facade for rule-based model role resolution.
 * Holds an in-memory cache of all rules (loaded from DB at startup).
 * Each rule has optional matchers (role, kind, userId, agentId) and a model assignment.
 * Resolution picks the most specific matching rule (most non-null matchers).
 *
 * Expects: load() is called once during engine start before any resolution.
 */
export class ModelRoles {
    private readonly repository: ModelRoleRulesRepository;
    private rules: ModelRoleRuleDbRecord[] = [];

    constructor(options: ModelRolesOptions) {
        this.repository = options.repository;
    }

    /**
     * Loads all rules from DB into memory.
     * Call once during engine initialization.
     */
    async load(): Promise<void> {
        this.rules = await this.repository.findAll();
        logger.debug(`load: Loaded ${this.rules.length} model role rule(s)`);
    }

    /**
     * Resolves the best matching model selection for the given context.
     * Returns the model/reasoning pair from the most specific matching rule, or undefined if no rules match.
     *
     * Specificity = count of non-null matchers. Ties broken by most recently created.
     */
    resolve(context: ModelRoleResolveContext): ModelSelectionConfig | undefined {
        return modelRoleRuleResolve(this.rules, context);
    }

    /**
     * Returns all rules.
     */
    list(): ModelRoleRuleDbRecord[] {
        return this.rules.map((r) => ({ ...r }));
    }

    /**
     * Creates a new rule. Persists to DB and updates cache.
     */
    async set(input: ModelRoleRuleCreateInput): Promise<ModelRoleRuleDbRecord> {
        const record = await this.repository.insert(input);
        this.rules.push(record);
        logger.info(
            `set: Model role rule created id=${record.id} role=${record.role} kind=${record.kind} userId=${record.userId} agentId=${record.agentId} model=${record.model} reasoning=${record.reasoning ?? "default"}`
        );
        return { ...record };
    }

    /**
     * Updates an existing rule. Persists to DB and updates cache.
     */
    async update(id: string, input: ModelRoleRuleUpdateInput): Promise<ModelRoleRuleDbRecord | null> {
        const updated = await this.repository.update(id, input);
        if (!updated) {
            return null;
        }
        const index = this.rules.findIndex((r) => r.id === id);
        if (index >= 0) {
            this.rules[index] = updated;
        }
        logger.info(
            `update: Model role rule updated id=${id} model=${updated.model} reasoning=${updated.reasoning ?? "default"}`
        );
        return { ...updated };
    }

    /**
     * Deletes a rule by id. Removes from DB and cache.
     */
    async delete(id: string): Promise<boolean> {
        const deleted = await this.repository.delete(id);
        if (deleted) {
            this.rules = this.rules.filter((r) => r.id !== id);
            logger.info(`delete: Model role rule deleted id=${id}`);
        }
        return deleted;
    }
}

/**
 * Finds the best matching rule for a given context.
 * A rule matches when ALL its non-null matchers equal the corresponding context value.
 * Among matching rules, the highest specificity (most matchers) wins.
 * Ties broken by most recently created.
 *
 * Returns the model selection or undefined if no rules match.
 */
export function modelRoleRuleResolve(
    rules: ModelRoleRuleDbRecord[],
    context: ModelRoleResolveContext
): ModelSelectionConfig | undefined {
    let bestRule: ModelRoleRuleDbRecord | null = null;
    let bestScore = -1;

    for (const rule of rules) {
        const score = modelRoleRuleScore(rule, context);
        if (score === null) {
            continue;
        }
        if (score > bestScore || (score === bestScore && bestRule && rule.createdAt > bestRule.createdAt)) {
            bestRule = rule;
            bestScore = score;
        }
    }

    if (!bestRule) {
        return undefined;
    }

    return bestRule.reasoning === null
        ? { model: bestRule.model }
        : { model: bestRule.model, reasoning: bestRule.reasoning };
}

/**
 * Scores a rule against a context.
 * Returns the number of matched matchers (specificity), or null if the rule does not match.
 */
function modelRoleRuleScore(rule: ModelRoleRuleDbRecord, context: ModelRoleResolveContext): number | null {
    let score = 0;

    if (rule.role !== null) {
        if (rule.role !== context.role) {
            return null;
        }
        score += 1;
    }

    if (rule.kind !== null) {
        if (rule.kind !== context.kind) {
            return null;
        }
        score += 1;
    }

    if (rule.userId !== null) {
        if (rule.userId !== context.userId) {
            return null;
        }
        score += 1;
    }

    if (rule.agentId !== null) {
        if (rule.agentId !== context.agentId) {
            return null;
        }
        score += 1;
    }

    return score;
}
