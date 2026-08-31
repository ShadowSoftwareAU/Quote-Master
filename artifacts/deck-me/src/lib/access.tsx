import { createContext, useContext, type ReactNode } from "react";
import type { BusinessProfile } from "@workspace/api-client-react";

type BusinessRole = "Owner" | "Employee" | "Subcontractor";

interface AccessIdentity {
  userId?: string | null;
  email?: string | null;
}

interface ProfileAccess {
  profile: BusinessProfile | null;
  role: BusinessRole | null;
  isMasterBuilder: boolean;
  isOwner: boolean;
  isSubcontractor: boolean;
  canViewFinancials: boolean;
  canManageTeam: boolean;
  canViewDashboard: boolean;
  canViewGeneralWorkspace: boolean;
  identity: AccessIdentity;
}

const ProfileAccessContext = createContext<ProfileAccess | null>(null);

export function ProfileAccessProvider({
  profile,
  identity = {},
  children,
}: {
  profile: BusinessProfile | null;
  identity?: AccessIdentity;
  children: ReactNode;
}) {
  const role = (profile?.role as BusinessRole | undefined) ?? null;
  const isOwner = role === "Owner";
  const isSubcontractor = role === "Subcontractor";
  return (
    <ProfileAccessContext.Provider value={{
      profile,
      role,
      isMasterBuilder: profile?.isMasterBuilder === true,
      isOwner,
      isSubcontractor,
      canViewFinancials: isOwner,
      canManageTeam: isOwner,
      canViewDashboard: !isSubcontractor,
      canViewGeneralWorkspace: !isSubcontractor,
      identity,
    }}>
      {children}
    </ProfileAccessContext.Provider>
  );
}

export function useProfileAccess(): ProfileAccess {
  const access = useContext(ProfileAccessContext);
  if (!access) throw new Error("useProfileAccess must be used inside ProfileAccessProvider");
  return access;
}

export function isAssignedToIdentity(record: unknown, identity: AccessIdentity): boolean {
  if (!record || typeof record !== "object") return false;
  const value = record as Record<string, any>;
  const assignee = value.assignedTo ?? value.assignee ?? value.assignedTeamMember;
  const userIds = [
    value.assignedToUserId,
    value.assigneeUserId,
    value.assignedClerkUserId,
    value.assignedUserId,
    assignee?.userId,
    assignee?.clerkUserId,
  ];
  return Boolean(identity.userId && userIds.includes(identity.userId));
}

export function visibleToProfile<T>(records: T[] | undefined, access: ProfileAccess): T[] {
  if (!records || !access.isSubcontractor) return records ?? [];
  return records.filter((record) => isAssignedToIdentity(record, access.identity));
}