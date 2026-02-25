import path from "node:path";
import type { PluginSystemPromptResult } from "@/types";
import type { TelegramProfile } from "./profileTypes.js";

/**
 * Renders a Telegram profile into a plugin prompt result for agent system prompts.
 * Expects: profile was produced by profileFetch/cache and contains fetchedAt metadata.
 */
export function profileRender(profile: TelegramProfile, userAvatarPaths: string[] = []): PluginSystemPromptResult {
    const fullName = [profile.firstName, profile.lastName].filter(Boolean).join(" ").trim() || profile.telegramUserId;
    const lines = ["## Telegram Profile", `Name: ${fullName}`, `Telegram user id: ${profile.telegramUserId}`];
    if (profile.username) {
        lines.push(`Username: @${profile.username}`);
    }
    if (profile.bio) {
        lines.push(`Bio: ${profile.bio}`);
    }
    if (profile.phone) {
        lines.push(`Phone: ${profile.phone}`);
    }
    if (userAvatarPaths.length > 0) {
        lines.push("Profile photos:");
        for (const avatarPath of userAvatarPaths) {
            // Text shows sandbox-relative path so the model can read() it
            lines.push(`- ~/downloads/${path.basename(avatarPath)}`);
        }
    }

    return userAvatarPaths.length > 0
        ? {
              text: lines.join("\n"),
              images: userAvatarPaths
          }
        : {
              text: lines.join("\n")
          };
}
