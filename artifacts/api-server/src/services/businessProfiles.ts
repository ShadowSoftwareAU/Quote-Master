import { and, asc, eq, inArray, lte, sql } from "drizzle-orm";
import { clerkClient } from "@clerk/express";
import {
  businessProfilesTable,
  db,
  profileMetadataOutboxTable,
  type BusinessProfileRow,
} from "@workspace/db";
import { profileTradeTypes } from "../lib/tradeCatalogue";

export const BUSINESS_ROLES = ["Owner", "Employee", "Subcontractor"] as const;
export type BusinessRole = (typeof BUSINESS_ROLES)[number];

export interface OnboardingProfileInput {
  businessName: string;
  phoneNumber: string;
  tradeType: string;
  tradeTypes?: string[];
  licenseNumber?: string | null;
  role: BusinessRole;
}

export interface ProfileSettingsInput {
  tradeTypes: string[];
  licenseNumber?: string | null;
}

export interface ClerkMetadataGateway {
  sync(
    userId: string,
    role: BusinessRole,
    tradeType: string,
    tradeTypes: string[],
  ): Promise<void>;
}

export class ProfileMetadataSyncError extends Error {
  constructor(
    message: string,
    readonly profile: BusinessProfileRow,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "ProfileMetadataSyncError";
  }
}

export class ProfileMetadataSupersededError extends Error {
  constructor(readonly profile: BusinessProfileRow) {
    super("A newer profile update superseded this metadata delivery");
    this.name = "ProfileMetadataSupersededError";
  }
}

export function buildClerkPublicMetadata(
  current: Record<string, unknown>,
  role: BusinessRole,
  tradeType: string,
  tradeTypes: string[] = [tradeType],
): Record<string, unknown> {
  const accessRole =
    current.accessRole ??
    (current.role === "MASTER_BUILDER" ? "MASTER_BUILDER" : undefined);

  return {
    ...current,
    ...(accessRole ? { accessRole } : {}),
    role,
    tradeType,
    tradeTypes,
  };
}

const defaultClerkGateway: ClerkMetadataGateway = {
  async sync(userId, role, tradeType, tradeTypes) {
    const user = await clerkClient.users.getUser(userId);
    const current = user.publicMetadata as Record<string, unknown>;

    await clerkClient.users.updateUserMetadata(userId, {
      publicMetadata: buildClerkPublicMetadata(
        current,
        role,
        tradeType,
        tradeTypes,
      ),
    });
  },
};

type BusinessProfileDb = typeof db;

function cleanOptional(value: string | null | undefined): string | null {
  const cleaned = value?.trim();
  return cleaned ? cleaned : null;
}

async function processProfileMetadataJob(
  jobId: number,
  database: BusinessProfileDb,
  clerkGateway: ClerkMetadataGateway,
  throwOnFailure: boolean,
): Promise<BusinessProfileRow> {
  const result = await database.transaction(async (tx) => {
    const [initialJob] = await tx
      .select()
      .from(profileMetadataOutboxTable)
      .where(eq(profileMetadataOutboxTable.id, jobId));
    if (!initialJob) throw new Error("Profile metadata job was not found");

    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${initialJob.clerkUserId}, 0))`,
    );
    const [job] = await tx
      .select()
      .from(profileMetadataOutboxTable)
      .where(eq(profileMetadataOutboxTable.id, jobId));
    const [profile] = await tx
      .select()
      .from(businessProfilesTable)
      .where(eq(businessProfilesTable.clerkUserId, initialJob.clerkUserId));
    if (!job || !profile) throw new Error("Profile metadata job is orphaned");

    if (job.profileVersion !== profile.metadataSyncVersion) {
      await tx
        .update(profileMetadataOutboxTable)
        .set({
          status: "superseded",
          processedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(profileMetadataOutboxTable.id, job.id));
      return { profile, error: null };
    }
    if (job.status === "completed") return { profile, error: null };

    try {
      await clerkGateway.sync(
        profile.clerkUserId,
        profile.role as BusinessRole,
        profile.tradeType,
        profileTradeTypes(profile),
      );
      const now = new Date();
      const [synced] = await tx
        .update(businessProfilesTable)
        .set({
          metadataSyncStatus: "synced",
          metadataSyncError: null,
          metadataSyncedAt: now,
          updatedAt: now,
        })
        .where(
          and(
            eq(businessProfilesTable.clerkUserId, profile.clerkUserId),
            eq(businessProfilesTable.metadataSyncVersion, job.profileVersion),
          ),
        )
        .returning();
      if (!synced) {
        const [current] = await tx
          .select()
          .from(businessProfilesTable)
          .where(eq(businessProfilesTable.clerkUserId, profile.clerkUserId));
        await tx
          .update(profileMetadataOutboxTable)
          .set({
            status: "superseded",
            attempts: job.attempts + 1,
            processedAt: now,
            updatedAt: now,
          })
          .where(eq(profileMetadataOutboxTable.id, job.id));
        return {
          profile: current ?? profile,
          error: new ProfileMetadataSupersededError(current ?? profile),
        };
      }
      await tx
        .update(profileMetadataOutboxTable)
        .set({
          status: "completed",
          attempts: job.attempts + 1,
          lastError: null,
          processedAt: now,
          updatedAt: now,
        })
        .where(eq(profileMetadataOutboxTable.id, job.id));
      return { profile: synced, error: null };
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message.slice(0, 500)
          : "Unknown Clerk error";
      const attempts = job.attempts + 1;
      const retryAt = new Date(
        Date.now() + Math.min(300_000, 1_000 * 2 ** attempts),
      );
      const [failed] = await tx
        .update(businessProfilesTable)
        .set({
          metadataSyncStatus: "failed",
          metadataSyncError: message,
          metadataSyncedAt: null,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(businessProfilesTable.clerkUserId, profile.clerkUserId),
            eq(businessProfilesTable.metadataSyncVersion, job.profileVersion),
          ),
        )
        .returning();
      await tx
        .update(profileMetadataOutboxTable)
        .set({
          status: "failed",
          attempts,
          availableAt: retryAt,
          lastError: message,
          updatedAt: new Date(),
        })
        .where(eq(profileMetadataOutboxTable.id, job.id));
      return { profile: failed ?? profile, error };
    }
  });

  if (result.error && throwOnFailure) {
    if (result.error instanceof ProfileMetadataSupersededError) {
      throw result.error;
    }
    throw new ProfileMetadataSyncError(
      "Profile saved, but Clerk metadata synchronisation failed",
      result.profile,
      { cause: result.error },
    );
  }
  return result.profile;
}

export async function processDueProfileMetadataJobs(
  database: BusinessProfileDb = db,
  clerkGateway: ClerkMetadataGateway = defaultClerkGateway,
): Promise<void> {
  const jobs = await database
    .select({ id: profileMetadataOutboxTable.id })
    .from(profileMetadataOutboxTable)
    .where(
      and(
        inArray(profileMetadataOutboxTable.status, ["pending", "failed"]),
        lte(profileMetadataOutboxTable.availableAt, new Date()),
      ),
    )
    .orderBy(asc(profileMetadataOutboxTable.availableAt))
    .limit(20);
  for (const job of jobs) {
    await processProfileMetadataJob(job.id, database, clerkGateway, false);
  }
}

export async function getBusinessProfile(
  clerkUserId: string,
  database: BusinessProfileDb = db,
): Promise<BusinessProfileRow | null> {
  const [profile] = await database
    .select()
    .from(businessProfilesTable)
    .where(eq(businessProfilesTable.clerkUserId, clerkUserId))
    .limit(1);
  return profile ?? null;
}

export async function setMasterBuilderFlag(
  clerkUserId: string,
  isMasterBuilder: boolean,
  database: BusinessProfileDb = db,
): Promise<BusinessProfileRow | null> {
  const [profile] = await database
    .update(businessProfilesTable)
    .set({ isMasterBuilder, updatedAt: new Date() })
    .where(eq(businessProfilesTable.clerkUserId, clerkUserId))
    .returning();
  return profile ?? null;
}

export async function onboardBusinessProfile(
  clerkUserId: string,
  input: OnboardingProfileInput,
  database: BusinessProfileDb = db,
  clerkGateway: ClerkMetadataGateway = defaultClerkGateway,
): Promise<BusinessProfileRow> {
  const tradeTypes =
    input.tradeTypes && input.tradeTypes.length > 0
      ? input.tradeTypes
      : [input.tradeType.trim()];
  const { profile, jobId } = await database.transaction(async (tx) => {
    const [profile] = await tx
      .insert(businessProfilesTable)
      .values({
        clerkUserId,
        businessName: input.businessName.trim(),
        phoneNumber: input.phoneNumber.trim(),
        tradeType: tradeTypes[0],
        tradeTypes,
        licenseNumber: cleanOptional(input.licenseNumber),
        role: input.role,
        metadataSyncStatus: "pending",
      })
      .onConflictDoUpdate({
        target: businessProfilesTable.clerkUserId,
        set: {
          businessName: input.businessName.trim(),
          phoneNumber: input.phoneNumber.trim(),
          tradeType: tradeTypes[0],
          tradeTypes,
          licenseNumber: cleanOptional(input.licenseNumber),
          metadataSyncStatus: "pending",
          metadataSyncError: null,
          metadataSyncedAt: null,
          metadataSyncVersion: sql`${businessProfilesTable.metadataSyncVersion} + 1`,
          updatedAt: new Date(),
        },
      })
      .returning();
    const [job] = await tx
      .insert(profileMetadataOutboxTable)
      .values({
        clerkUserId,
        profileVersion: profile.metadataSyncVersion,
      })
      .onConflictDoUpdate({
        target: [
          profileMetadataOutboxTable.clerkUserId,
          profileMetadataOutboxTable.profileVersion,
        ],
        set: {
          status: "pending",
          availableAt: new Date(),
          updatedAt: new Date(),
        },
      })
      .returning({ id: profileMetadataOutboxTable.id });
    return { profile, jobId: job.id };
  });
  return processProfileMetadataJob(jobId, database, clerkGateway, true);
}

export async function updateBusinessProfileSettings(
  clerkUserId: string,
  input: ProfileSettingsInput,
  database: BusinessProfileDb = db,
  clerkGateway: ClerkMetadataGateway = defaultClerkGateway,
): Promise<BusinessProfileRow | null> {
  const queued = await database.transaction(async (tx) => {
    const [profile] = await tx
      .update(businessProfilesTable)
      .set({
        tradeType: input.tradeTypes[0],
        tradeTypes: input.tradeTypes,
        licenseNumber: cleanOptional(input.licenseNumber),
        metadataSyncStatus: "pending",
        metadataSyncError: null,
        metadataSyncedAt: null,
        metadataSyncVersion: sql`${businessProfilesTable.metadataSyncVersion} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(businessProfilesTable.clerkUserId, clerkUserId))
      .returning();
    if (!profile) return null;
    const [job] = await tx
      .insert(profileMetadataOutboxTable)
      .values({
        clerkUserId,
        profileVersion: profile.metadataSyncVersion,
      })
      .onConflictDoUpdate({
        target: [
          profileMetadataOutboxTable.clerkUserId,
          profileMetadataOutboxTable.profileVersion,
        ],
        set: {
          status: "pending",
          availableAt: new Date(),
          updatedAt: new Date(),
        },
      })
      .returning({ id: profileMetadataOutboxTable.id });
    return { jobId: job.id };
  });

  if (!queued) return null;
  return processProfileMetadataJob(queued.jobId, database, clerkGateway, true);
}
