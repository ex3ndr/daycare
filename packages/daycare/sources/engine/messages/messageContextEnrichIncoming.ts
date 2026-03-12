import type { MessageContext, MessageContextEnrichment, UserDbRecord } from "@/types";
import { timezoneIsValid } from "../../utils/timezoneIsValid.js";

export type MessageContextEnrichIncomingOptions = {
    context: MessageContext;
    user: Pick<UserDbRecord, "timezone" | "firstName" | "lastName"> | null;
};

/**
 * Enriches incoming message context with stable key/value metadata tags.
 * Expects: user belongs to the active message scope.
 */
export async function messageContextEnrichIncoming(
    options: MessageContextEnrichIncomingOptions
): Promise<MessageContext> {
    const context = options.context;
    const user = options.user;
    const enrichments = [...(context.enrichments ?? [])];

    const profileTimezoneRaw = user?.timezone?.trim() ?? "";
    const profileTimezone = profileTimezoneRaw && timezoneIsValid(profileTimezoneRaw) ? profileTimezoneRaw : "";

    const incomingTimezoneRaw = context.timezone?.trim() ?? "";
    const incomingTimezone = incomingTimezoneRaw && timezoneIsValid(incomingTimezoneRaw) ? incomingTimezoneRaw : "";

    if (user && incomingTimezone && !profileTimezone) {
        enrichmentsAppend(enrichments, {
            key: "timezone_set_notice",
            value: `Timezone ${incomingTimezone} is available in message context while profile timezone is unset. Set it with user_profile_update without asking the user again.`
        });
    }

    if (user && incomingTimezone && profileTimezone && incomingTimezone !== profileTimezone) {
        enrichmentsAppend(enrichments, {
            key: "timezone_change_notice",
            value: `Message context timezone changed from profile timezone ${profileTimezone} to ${incomingTimezone}. Update profile timezone with user_profile_update.`
        });
    }

    if (user && !incomingTimezone && !profileTimezone) {
        enrichmentsAppend(enrichments, {
            key: "timezone_missing_notice",
            value: "User timezone is not set. Ask the user for their timezone and set it via user_profile_update."
        });
    }

    if (user && namesMissing(user)) {
        enrichmentsAppend(enrichments, {
            key: "profile_name_notice",
            value: "User first/last name are not set. If the name is visible from the context (e.g. connector profile, message signature), set it via user_profile_update. Otherwise, ask the user for their name."
        });
    }

    const timezone = incomingTimezone || profileTimezone;
    return {
        ...(context.messageId ? { messageId: context.messageId } : {}),
        ...(context.connectorKey ? { connectorKey: context.connectorKey } : {}),
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
