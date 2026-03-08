import type { Context, UserConfiguration } from "@/types";

export type ProfileUserRecord = {
    firstName: string | null;
    lastName: string | null;
    bio: string | null;
    about: string | null;
    country: string | null;
    timezone: string | null;
    systemPrompt: string | null;
    memory: boolean;
    configuration: UserConfiguration;
    nametag: string;
    connectorKeys: Array<{ connectorKey: string }>;
};

export type ProfileReadInput = {
    ctx: Context;
    users: {
        findById: (id: string) => Promise<ProfileUserRecord | null>;
    };
};

export type ProfileReadResult =
    | {
          ok: true;
          profile: {
              firstName: string | null;
              lastName: string | null;
              bio: string | null;
              about: string | null;
              country: string | null;
              timezone: string | null;
              systemPrompt: string | null;
              memory: boolean;
              configuration: UserConfiguration;
              nametag: string;
              emails: string[];
          };
      }
    | {
          ok: false;
          error: string;
      };

/**
 * Reads the authenticated user's profile fields used by the app.
 * Expects: ctx.userId belongs to an existing user record.
 */
export async function profileRead(input: ProfileReadInput): Promise<ProfileReadResult> {
    const user = await input.users.findById(input.ctx.userId);
    if (!user) {
        return { ok: false, error: "User not found." };
    }

    return {
        ok: true,
        profile: {
            firstName: user.firstName,
            lastName: user.lastName,
            bio: user.bio,
            about: user.about,
            country: user.country,
            timezone: user.timezone,
            systemPrompt: user.systemPrompt,
            memory: user.memory,
            configuration: user.configuration,
            nametag: user.nametag,
            emails: profileEmailsList(user.connectorKeys)
        }
    };
}

function profileEmailsList(connectorKeys: Array<{ connectorKey: string }>): string[] {
    return connectorKeys
        .map((entry) => (entry.connectorKey.startsWith("email:") ? entry.connectorKey.slice("email:".length) : null))
        .filter((value): value is string => !!value)
        .sort((left, right) => left.localeCompare(right));
}
