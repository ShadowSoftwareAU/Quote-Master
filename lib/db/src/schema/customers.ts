import { index, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const customersTable = pgTable(
  "customers",
  {
    id: serial("id").primaryKey(),
    clerkUserId: text("clerk_user_id"),
    name: text("name").notNull(),
    company: text("company"),
    email: text("email"),
    phone: text("phone"),
    address: text("address"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("customers_clerk_user_id_idx").on(table.clerkUserId)],
);

export type Customer = typeof customersTable.$inferSelect;
