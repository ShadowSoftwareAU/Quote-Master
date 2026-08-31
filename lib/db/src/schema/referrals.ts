import {
  pgTable,
  serial,
  text,
  timestamp,
  index,
} from "drizzle-orm/pg-core";

export const referralSourcesTable = pgTable(
  "referral_sources",
  {
    id: serial("id").primaryKey(),
    clerkUserId: text("clerk_user_id"),
    code: text("code").notNull().unique(),
    name: text("name").notNull(),
    type: text("type").notNull().default("other"), // supplier | training | word_of_mouth | direct | other
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("referral_sources_clerk_user_id_idx").on(table.clerkUserId)],
);

export const signUpLeadsTable = pgTable(
  "sign_up_leads",
  {
    id: serial("id").primaryKey(),
    clerkUserId: text("clerk_user_id"),
    name: text("name").notNull(),
    email: text("email"),
    phone: text("phone"),
    company: text("company"),
    referralCode: text("referral_code"),
    utmSource: text("utm_source"),
    utmMedium: text("utm_medium"),
    utmCampaign: text("utm_campaign"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("sign_up_leads_clerk_user_id_idx").on(table.clerkUserId)],
);

export type ReferralSourceRow = typeof referralSourcesTable.$inferSelect;
export type SignUpLeadRow = typeof signUpLeadsTable.$inferSelect;
