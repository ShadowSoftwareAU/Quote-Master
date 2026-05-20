import {
  pgTable,
  serial,
  text,
  integer,
  timestamp,
  json,
} from "drizzle-orm/pg-core";

export const bookingsTable = pgTable("bookings", {
  id: serial("id").primaryKey(),
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
});

export type BookingRow = typeof bookingsTable.$inferSelect;
