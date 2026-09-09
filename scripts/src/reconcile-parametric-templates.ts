import { readFile } from "node:fs/promises";
import pg from "pg";

const { DATABASE_URL } = process.env;
if (!DATABASE_URL) throw new Error("DATABASE_URL is required");
const sql = await readFile(
  new URL("../../lib/db/drizzle/0014_parametric_trade_templates.sql", import.meta.url),
  "utf8",
);
const pool = new pg.Pool({ connectionString: DATABASE_URL });
try {
  await pool.query(sql);
} finally {
  await pool.end();
}