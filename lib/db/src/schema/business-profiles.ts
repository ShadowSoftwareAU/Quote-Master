import {
  boolean,
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const businessProfilesTable = pgTable(
  "business_profiles",
  {
    id: serial("id").primaryKey(),
    clerkUserId: text("clerk_user_id").notNull(),
    businessName: text("business_name").notNull(),
    phoneNumber: text("phone_number").notNull(),
    tradeType: text("trade_type").notNull(),
    tradeTypes: text("trade_types")
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),
    licenseNumber: text("license_number"),
    role: text("role").notNull(),
    isMasterBuilder: boolean("is_master_builder").notNull().default(false),
    metadataSyncStatus: text("metadata_sync_status").notNull().default("pending"),
    metadataSyncError: text("metadata_sync_error"),
    metadataSyncVersion: integer("metadata_sync_version").notNull().default(1),
    metadataSyncedAt: timestamp("metadata_synced_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("business_profiles_clerk_user_id_uidx").on(table.clerkUserId),
  ],
);

export type BusinessProfileRow = typeof businessProfilesTable.$inferSelect;

export const profileMetadataOutboxTable = pgTable(
  "profile_metadata_outbox",
  {
    id: serial("id").primaryKey(),
    clerkUserId: text("clerk_user_id").notNull(),
    profileVersion: integer("profile_version").notNull(),
    status: text("status").notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    availableAt: timestamp("available_at", { withTimezone: true }).notNull().defaultNow(),
    lastError: text("last_error"),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("profile_metadata_outbox_user_version_uidx").on(
      table.clerkUserId,
      table.profileVersion,
    ),
    index("profile_metadata_outbox_due_idx").on(table.status, table.availableAt),
  ],
);

export type ProfileMetadataOutboxRow =
  typeof profileMetadataOutboxTable.$inferSelect;