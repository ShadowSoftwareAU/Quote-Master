import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";

const hasDatabase = Boolean(process.env.DATABASE_URL);
const fixture = `isolation-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const userA = `${fixture}-user-a`;
const userB = `${fixture}-user-b`;
let tempDir;
let server;
let baseUrl;
let pool;
const createdCustomerIds = [];
const createdQuoteIds = [];
const createdProjectIds = [];

async function api(userId, method, pathname, body) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    method,
    headers: {
      ...(userId ? { "x-isolation-test-user": userId } : {}),
      ...(body ? { "content-type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = response.headers.get("content-type")?.includes("application/json")
    ? await response.json()
    : undefined;
  return { response, json };
}

before(async () => {
  if (!hasDatabase) return;
  tempDir = await mkdtemp(path.join(os.tmpdir(), "api-router-isolation-"));
  await build({
    entryPoints: [path.resolve("test/router-fixture-entry.ts")],
    outfile: path.join(tempDir, "router.cjs"),
    bundle: true,
    platform: "node",
    // Several production dependencies are CommonJS. Keep the disposable test
    // bundle CommonJS so their Node built-in requires remain native requires.
    format: "cjs",
    plugins: [{
      name: "fixture-clerk-context",
      setup(buildContext) {
        buildContext.onResolve({ filter: /^@clerk\/express$/ }, () => ({
          path: "fixture-clerk",
          namespace: "fixture",
        }));
        buildContext.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({
          contents: "export const getAuth = (req) => ({ userId: req.clerkUserId ?? null });",
          loader: "js",
        }));
      },
    }],
  });
  const module = await import(pathToFileURL(path.join(tempDir, "router.cjs")).href);
  pool = module.pool;
  server = module.app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (!hasDatabase) return;
  try {
    // Every inserted row has a unique test-only name/prefix. Delete children
    // first so cleanup remains safe if a future fixture adds a reference.
    if (createdQuoteIds.length) {
      await pool.query("DELETE FROM quote_line_items WHERE quote_id = ANY($1::int[])", [createdQuoteIds]);
      await pool.query("DELETE FROM quotes WHERE id = ANY($1::int[])", [createdQuoteIds]);
    }
    if (createdProjectIds.length) {
      await pool.query("DELETE FROM master_projects WHERE id = ANY($1::int[])", [createdProjectIds]);
    }
    if (createdCustomerIds.length) {
      await pool.query("DELETE FROM bookings WHERE customer_id = ANY($1::int[])", [createdCustomerIds]);
    }
    await pool.query("DELETE FROM customers WHERE name LIKE $1", [`${fixture}%`]);
  } finally {
    if (server) {
      await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
    if (pool) await pool.end();
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("database-backed customer and nested route isolation", { skip: !hasDatabase }, async () => {
  const createdA = await api(userA, "POST", "/customers", { name: `${fixture}-customer-a` });
  const createdB = await api(userB, "POST", "/customers", { name: `${fixture}-customer-b` });
  assert.equal(createdA.response.status, 201);
  assert.equal(createdB.response.status, 201);
  createdCustomerIds.push(createdA.json.id, createdB.json.id);

  // Direct legacy fixture: nullable ownership must not be treated as shared.
  const legacy = await pool.query(
    "INSERT INTO customers (name, clerk_user_id) VALUES ($1, NULL) RETURNING id",
    [`${fixture}-legacy-null-owner`],
  );
  createdCustomerIds.push(legacy.rows[0].id);

  const listA = await api(userA, "GET", "/customers");
  assert.equal(listA.response.status, 200);
  assert.deepEqual(listA.json.map((customer) => customer.id), [createdA.json.id]);

  for (const [method, body] of [
    ["GET", undefined],
    ["PATCH", { name: `${fixture}-hijack` }],
    ["DELETE", undefined],
  ]) {
    const result = await api(userA, method, `/customers/${createdB.json.id}`, body);
    assert.equal(result.response.status, 404, `${method} must not reach user B's customer`);
  }
  assert.equal((await api(userA, "GET", `/customers/${legacy.rows[0].id}`)).response.status, 404);

  const updated = await api(userA, "PATCH", `/customers/${createdA.json.id}`, {
    name: `${fixture}-customer-a-updated`,
  });
  assert.equal(updated.response.status, 200);
  assert.equal(updated.json.name, `${fixture}-customer-a-updated`);
  assert.equal((await api(userA, "DELETE", `/customers/${createdA.json.id}`)).response.status, 200);

  // This uses the actual booking handler: user A cannot create a child record
  // referencing user B's parent customer.
  const crossOwnerBooking = await api(userA, "POST", "/bookings", {
    title: `${fixture}-cross-owner-booking`,
    customerId: createdB.json.id,
    startAt: "2030-01-01T09:00:00.000Z",
    endAt: "2030-01-01T10:00:00.000Z",
  });
  assert.equal(crossOwnerBooking.response.status, 400);

  const quoteCustomer = await api(userA, "POST", "/customers", {
    name: `${fixture}-public-quote-customer`,
  });
  assert.equal(quoteCustomer.response.status, 201);
  createdCustomerIds.push(quoteCustomer.json.id);
  const quote = await api(userA, "POST", "/quotes", {
    title: `${fixture}-public-upgrade-quote`,
    customerId: quoteCustomer.json.id,
    lengthM: 3,
    widthM: 2,
    labourHours: 10,
    labourRate: 100,
  });
  assert.equal(quote.response.status, 201);
  createdQuoteIds.push(quote.json.id);

  // Master-project writes require a role, so use direct disposable setup for
  // this relationship while exercising the actual public quote update route.
  const project = await pool.query(
    "INSERT INTO master_projects (title, customer_id, builder_margin_pct) VALUES ($1, $2, 0) RETURNING id",
    [`${fixture}-master-project`, quoteCustomer.json.id],
  );
  createdProjectIds.push(project.rows[0].id);
  await pool.query("UPDATE quotes SET master_project_id = $1 WHERE id = $2", [
    project.rows[0].id,
    quote.json.id,
  ]);

  // No auth context is installed: the actual portal and its deliberately
  // limited upgrade PATCH remain available to the customer.
  assert.equal((await api(null, "GET", `/quotes/${quote.json.id}/portal`)).response.status, 200);
  const upgraded = await api(null, "PATCH", `/quotes/${quote.json.id}`, {
    deckBoardType: "public-upgrade-fixture",
  });
  assert.equal(upgraded.response.status, 200);
  assert.equal(upgraded.json.spec.deckBoardType, "public-upgrade-fixture");

  // The public update recalculates after commit. With one child quote and a
  // zero project margin, both independently calculated GST-inclusive totals
  // must agree exactly.
  const totals = await pool.query(
    `SELECT q.total AS quote_total, p.total AS project_total
       FROM quotes q JOIN master_projects p ON p.id = q.master_project_id
      WHERE q.id = $1`,
    [quote.json.id],
  );
  assert.equal(Number(totals.rows[0].quote_total), Number(totals.rows[0].project_total));
});