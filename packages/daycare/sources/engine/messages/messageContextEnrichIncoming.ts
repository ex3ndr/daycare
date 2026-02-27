import type { MessageContext, MessageContextEnrichment, UserDbRecord } from "@/types";
import { timezoneIsValid } from "../../util/timezoneIsValid.js";

export type MessageContextEnrichIncomingOptions = {
    context: MessageContext;
    user: Pick<UserDbRecord, "timezone" | "firstName" | "lastName"> | null;
    timezonePersist: (timezone: string) => Promise<void>;
};

/**
 * Enriches incoming message context with stable key/value metadata tags.
 * Expects: user belongs to the active message scope and timezonePersist updates profile timezone.
 */
export async function messageContextEnrichIncoming(options: MessageContextEnrichIncomingOptions): Promise<MessageContext> {
    const context = options.context;
    const user = options.user;
    const enrichments = [...(context.enrichments ?? [])];

    const profileTimezoneRaw = user?.timezone?.trim() ?? "";
    const profileTimezone = profileTimezoneRaw && timezoneIsValid(profileTimezoneRaw) ? profileTimezoneRaw : "";

    const incomingTimezoneRaw = context.timezone?.trim() ?? "";
    const incomingTimezone = incomingTimezoneRaw && timezoneIsValid(incomingTimezoneRaw) ? incomingTimezoneRaw : "";

    if (user && incomingTimezone && incomingTimezone !== profileTimezoneRaw) {
        await options.timezonePersist(incomingTimezone);
        const previous = profileTimezoneRaw || "unset";
        enrichmentsAppend(enrichments, {
            key: "timezone_change_notice",
            value: `Timezone updated automatically from ${previous} to ${incomingTimezone}.`
        });
    }

    if (user && namesMissing(user)) {
        enrichmentsAppend(enrichments, {
            key: "profile_name_notice",
            value: "User first/last name are not set. Ask the user and call user_profile_update ASAP."
        });
    }

    const timezone = incomingTimezone || profileTimezone;
    return {
        ...(context.messageId ? { messageId: context.messageId } : {}),
        ...(timezone ? { timezone } : {}),
        ...(enrichments.length > 0 ? { enrichments } : {})
    };
}

function namesMissing(user: Pick<UserDbRecord, "firstName" | "lastName">): boolean {
    const firstName = user.firstName?.trim() ?? "";
    const lastName = user.lastName?.trim() ?? "";
    return !firstName && !lastName;
}

function enrichmentsAppend(target: MessageContextEnrichment[], next: MessageContextEnrichment): void {
    const key = next.key.trim();
    const value = next.value.trim();
    if (!key || !value) {
        return;
    }
    if (target.some((item) => item.key === key && item.value === value)) {
        return;
    }
    target.push({ key, value });
}
