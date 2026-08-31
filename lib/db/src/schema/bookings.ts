import {
  pgTable,
  serial,
  text,
  integer,
  timestamp,
  json,
  index,
} from "drizzle-orm/pg-core";

export const bookingsTable = pgTable(
  "bookings",
  {
    id: serial("id").primaryKey(),
    clerkUserId: text("clerk_user_id"),
    title: text("title").notNull(),
    customerId: integer("customer_id"),
    quoteId: integer("quote_id"),
    siteAddress: text("site_address"),
    notes: text("notes"),
    startAt: timestamp("start_at", { withTimezone: true }).notNull(),
    endAt: timestamp("end_at", { withTimezone: true }).notNull(),
    status: text("status").notNull().default("scheduled"),
    photos: json("photos").$type<string[]>().default([]),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("bookings_clerk_user_id_idx").on(table.clerkUserId)],
);

export type BookingRow = typeof bookingsTable.$inferSelect;
