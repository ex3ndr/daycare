export type MemberItem = {
    userId: string;
    nametag: string;
    firstName: string | null;
    lastName: string | null;
    joinedAt: number;
    isOwner: boolean;
};

export type MembersInviteCreateResult =
    | {
          ok: true;
          url: string;
          token: string;
          expiresAt: number;
      }
    | {
          ok: false;
          error: string;
      };

export type MemberKickResult =
    | {
          ok: true;
      }
    | {
          ok: false;
          error: string;
      };

export type MembersInviteAcceptResult =
    | {
          ok: true;
          workspaceId: string;
      }
    | {
          ok: false;
          error: string;
      };
