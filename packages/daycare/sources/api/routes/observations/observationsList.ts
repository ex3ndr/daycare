import type { Context } from "@/types";

export type ObservationItem = {
    id: string;
    type: string;
    source: string;
    message: string;
    details: string | null;
    createdAt: number;
};

export type ObservationsListInput = {
    ctx: Context;
    fetchRecent: (ctx: Context, limit: number) => Promise<ObservationItem[]>;
    limit: number;
};

export type ObservationsListResult = {
    ok: true;
    observations: ObservationItem[];
};

/**
 * Lists recent observations for the authenticated user.
 * Expects: fetchRecent returns observation log entries scoped to ctx.userId.
 */
export async function observationsList(input: ObservationsListInput): Promise<ObservationsListResult> {
    const observations = await input.fetchRecent(input.ctx, input.limit);
    return { ok: true, observations };
}
