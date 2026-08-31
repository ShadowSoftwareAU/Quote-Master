import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  timestamp,
  json,
  index,
} from "drizzle-orm/pg-core";

export const portfolioEntriesTable = pgTable(
  "portfolio_entries",
  {
    id: serial("id").primaryKey(),
    clerkUserId: text("clerk_user_id"),
    bookingId: integer("booking_id"),
    title: text("title").notNull(),
    description: text("description"),
    deckType: text("deck_type"),
    dimensionText: text("dimension_text"),
    materialsText: text("materials_text"),
    beforePhotos: json("before_photos").$type<string[]>().default([]),
    afterPhotos: json("after_photos").$type<string[]>().default([]),
    testimonial: text("testimonial"),
    customerName: text("customer_name"),
    rating: integer("rating"),
    isPublic: boolean("is_public").notNull().default(true),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("portfolio_entries_clerk_user_id_idx").on(table.clerkUserId)],
);

export type PortfolioEntryRow = typeof portfolioEntriesTable.$inferSelect;
