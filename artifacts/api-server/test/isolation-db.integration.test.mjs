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
const assignmentOwner = `${fixture}-assignment-owner`;
const linkedWorker = `${fixture}-linked-worker`;
const profilelessWorker = `${fixture}-profileless-worker`;
const unlinkedWorker = `${fixture}-unlinked-worker`;
const demoOwner = `${fixture}-demo-owner`;
const demoEmployee = `${fixture}-demo-employee`;
const assignmentUsers = [assignmentOwner, linkedWorker, profilelessWorker, unlinkedWorker];
const profileUsers = [userA, userB, demoOwner, demoEmployee, ...assignmentUsers];
let tempDir;
let server;
let baseUrl;
let pool;
let processDueProfileMetadataJobs;
const createdCustomerIds = [];
const createdQuoteIds = [];
const createdProjectIds = [];
const createdMaterialIds = [];
const createdBookingIds = [];
const createdMemberIds = [];

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
        buildContext.onResolve({ filter: /^pdfkit$/ }, () => ({
          path: "fixture-pdfkit",
          namespace: "fixture-pdfkit",
        }));
        buildContext.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({
          contents: `
            export const getAuth = (req) => ({ userId: req.clerkUserId ?? null });
            export const clerkClient = {
              users: {
                getUser: async () => ({
                  publicMetadata: { role: "MASTER_BUILDER", existing: "preserved" },
                }),
                updateUserMetadata: async (userId, update) => {
                  if (globalThis.__failProfileMetadataSync) {
                    throw new Error("Fixture Clerk outage");
                  }
                  globalThis.__profileMetadataUpdates ??= [];
                  globalThis.__profileMetadataUpdates.push({ userId, update });
                },
              },
            };
          `,
          loader: "js",
        }));
        buildContext.onLoad(
          { filter: /.*/, namespace: "fixture-pdfkit" },
          () => ({
            contents: `
              export default class FixturePdfDocument {
                pipe(response) { this.response = response; return response; }
                rect() { return this; }
                fill() { return this; }
                fontSize() { return this; }
                font() { return this; }
                fillColor() { return this; }
                text() { return this; }
                moveTo() { return this; }
                lineTo() { return this; }
                strokeColor() { return this; }
                stroke() { return this; }
                addPage() { return this; }
                heightOfString() { return 12; }
                end() { this.response.end("%PDF-fixture"); }
              }
            `,
            loader: "js",
          }),
        );
      },
    }],
  });
  const module = await import(pathToFileURL(path.join(tempDir, "router.cjs")).href);
  pool = module.pool;
  processDueProfileMetadataJobs = module.processDueProfileMetadataJobs;
  server = module.app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (!hasDatabase) return;
  try {
    await pool.query("DROP TRIGGER IF EXISTS job_assignment_race_barrier ON job_assignments");
    await pool.query("DROP FUNCTION IF EXISTS job_assignment_race_barrier()");
    // Every inserted row has a unique test-only name/prefix. Delete children
    // first so cleanup remains safe if a future fixture adds a reference.
    if (createdQuoteIds.length) {
      await pool.query("DELETE FROM quote_line_items WHERE quote_id = ANY($1::int[])", [createdQuoteIds]);
      await pool.query("DELETE FROM quotes WHERE id = ANY($1::int[])", [createdQuoteIds]);
    }
    if (createdProjectIds.length) {
      await pool.query("DELETE FROM master_projects WHERE id = ANY($1::int[])", [createdProjectIds]);
    }
    if (createdBookingIds.length) {
      await pool.query("DELETE FROM time_entries WHERE job_id = ANY($1::int[])", [createdBookingIds]);
      await pool.query("DELETE FROM job_assignments WHERE job_id = ANY($1::int[])", [createdBookingIds]);
    }
    if (createdMemberIds.length) {
      await pool.query("DELETE FROM job_assignments WHERE team_member_id = ANY($1::int[])", [createdMemberIds]);
      await pool.query("DELETE FROM team_members WHERE id = ANY($1::int[])", [createdMemberIds]);
    }
    if (createdCustomerIds.length) {
      await pool.query("DELETE FROM bookings WHERE customer_id = ANY($1::int[])", [createdCustomerIds]);
      await pool.query("DELETE FROM customers WHERE id = ANY($1::int[])", [createdCustomerIds]);
    }
    if (createdMaterialIds.length) {
      await pool.query("DELETE FROM materials WHERE id = ANY($1::int[])", [createdMaterialIds]);
    }
    await pool.query(
      "DELETE FROM profile_metadata_outbox WHERE clerk_user_id = ANY($1::text[])",
      [profileUsers],
    );
    await pool.query(
      "DELETE FROM business_profiles WHERE clerk_user_id = ANY($1::text[])",
      [profileUsers],
    );
    await pool.query("DELETE FROM customers WHERE name LIKE $1", [`${fixture}%`]);
  } finally {
    if (server) {
      await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
    if (pool) await pool.end();
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("database-backed onboarding and profile settings stay user scoped", { skip: !hasDatabase }, async () => {
  const onboarding = await api(userA, "POST", "/onboarding", {
    businessName: `${fixture} Carpentry Pty Ltd`,
    phoneNumber: "+61 412 345 678",
    tradeType: "Carpenter",
    licenseNumber: "QBCC 1234567",
    role: "Owner",
  });
  assert.equal(onboarding.response.status, 201);
  assert.equal(onboarding.json.metadataSyncStatus, "synced");
  assert.equal(onboarding.json.isMasterBuilder, false);
  assert.equal(onboarding.json.clerkUserId, undefined);

  const profileRead = await api(userA, "GET", "/settings/profile");
  assert.equal(profileRead.response.status, 200);
  assert.equal(profileRead.json.businessName, `${fixture} Carpentry Pty Ltd`);
  assert.equal(profileRead.json.clerkUserId, undefined);
  assert.equal((await api(userA, "GET", "/dashboard/pnl")).response.status, 200);
  assert.equal((await api(userA, "GET", "/team")).response.status, 200);
  const enabledMasterBuilder = await api(userA, "PATCH", "/settings/profile/master-builder", {
    isMasterBuilder: true,
  });
  assert.equal(enabledMasterBuilder.response.status, 200);
  assert.equal(enabledMasterBuilder.json.isMasterBuilder, true);
  assert.equal((await api(userA, "GET", "/master-projects")).response.status, 200);

  const missingProfileRead = await api(userB, "GET", "/settings/profile");
  assert.equal(missingProfileRead.response.status, 404);

  const foreignUpdate = await api(userB, "PUT", "/settings/profile", {
    tradeType: "Plumber",
    role: "Employee",
    licenseNumber: "NSW 7654321",
  });
  assert.equal(foreignUpdate.response.status, 404);

  const update = await api(userA, "PUT", "/settings/profile", {
    tradeType: "Builder",
    role: "Owner",
    licenseNumber: "QBCC 7654321",
  });
  assert.equal(update.response.status, 200);
  assert.equal(update.json.tradeType, "Builder");
  assert.equal(update.json.role, "Owner");
  assert.equal(update.json.metadataSyncStatus, "synced");

  await pool.query("UPDATE business_profiles SET role = 'Employee' WHERE clerk_user_id = $1", [userA]);
  assert.equal((await api(userA, "GET", "/dashboard/pnl")).response.status, 403);
  assert.equal((await api(userA, "GET", "/team")).response.status, 403);
  assert.equal(
    (await api(userA, "PUT", "/settings/profile", {
      tradeType: "Builder",
      role: "Owner",
      licenseNumber: "QBCC 7654321",
    })).response.status,
    403,
  );
  assert.equal(
    (await api(userA, "PATCH", "/settings/profile/master-builder", { isMasterBuilder: false })).response.status,
    403,
  );

  await pool.query("UPDATE business_profiles SET role = 'Subcontractor' WHERE clerk_user_id = $1", [userA]);
  assert.equal((await api(userA, "GET", "/dashboard/pnl")).response.status, 403);
  assert.equal((await api(userA, "GET", "/team")).response.status, 403);

  const stored = await pool.query(
    "SELECT clerk_user_id, trade_type, role, metadata_sync_status FROM business_profiles WHERE clerk_user_id = $1",
    [userA],
  );
  assert.deepEqual(stored.rows, [{
    clerk_user_id: userA,
    trade_type: "Builder",
    role: "Subcontractor",
    metadata_sync_status: "synced",
  }]);

  const metadataUpdates = globalThis.__profileMetadataUpdates ?? [];
  const latest = metadataUpdates.at(-1);
  assert.equal(latest.userId, userA);
  assert.deepEqual(latest.update.publicMetadata, {
    role: "Owner",
    accessRole: "MASTER_BUILDER",
    tradeType: "Builder",
    existing: "preserved",
  });
});

test("failed Clerk metadata delivery retries from the durable outbox", { skip: !hasDatabase }, async () => {
  globalThis.__failProfileMetadataSync = true;
  const failed = await api(userB, "POST", "/onboarding", {
    businessName: `${fixture} Plumbing Pty Ltd`,
    phoneNumber: "07 3123 4567",
    tradeType: "Plumber",
    licenseNumber: "QLD 998877",
    role: "Owner",
  });
  assert.equal(failed.response.status, 502);
  assert.equal(failed.json.retryable, true);

  const beforeRetry = await pool.query(
    "SELECT metadata_sync_status FROM business_profiles WHERE clerk_user_id = $1",
    [userB],
  );
  assert.equal(beforeRetry.rows[0].metadata_sync_status, "failed");

  globalThis.__failProfileMetadataSync = false;
  await pool.query(
    "UPDATE profile_metadata_outbox SET available_at = now() WHERE clerk_user_id = $1",
    [userB],
  );
  await processDueProfileMetadataJobs();

  const afterRetry = await pool.query(
    "SELECT metadata_sync_status FROM business_profiles WHERE clerk_user_id = $1",
    [userB],
  );
  assert.equal(afterRetry.rows[0].metadata_sync_status, "synced");
  assert.equal(
    (globalThis.__profileMetadataUpdates ?? []).some((update) => update.userId === userB),
    true,
  );

  const masterBuilder = await api(userB, "PATCH", "/settings/profile/master-builder", {
    isMasterBuilder: true,
  });
  assert.equal(masterBuilder.response.status, 200);
  assert.equal(masterBuilder.json.isMasterBuilder, true);
  const flags = await pool.query(
    "SELECT clerk_user_id, is_master_builder FROM business_profiles WHERE clerk_user_id = ANY($1::text[]) ORDER BY clerk_user_id",
    [[userA, userB]],
  );
  assert.deepEqual(flags.rows, [
    { clerk_user_id: userA, is_master_builder: true },
    { clerk_user_id: userB, is_master_builder: true },
  ]);
});

test("development demo seed enforces access, scope, counts, states, and linkage", { skip: !hasDatabase }, async () => {
  for (const [userId, role] of [[demoOwner, "Owner"], [demoEmployee, "Employee"]]) {
    const onboarding = await api(userId, "POST", "/onboarding", {
      businessName: `${fixture} ${role} Demo`,
      phoneNumber: "+61 412 345 678",
      tradeType: "Builder",
      licenseNumber: "NSW 123456C",
      role,
    });
    assert.equal(onboarding.response.status, 201);
  }

  const originalNodeEnv = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = "production";
    assert.equal(
      (await api(demoOwner, "POST", "/settings/seed-demo-data", {})).response.status,
      404,
    );

    process.env.NODE_ENV = "development";
    assert.equal(
      (await api(null, "POST", "/settings/seed-demo-data", {})).response.status,
      401,
    );
    assert.equal(
      (await api(demoEmployee, "POST", "/settings/seed-demo-data", {})).response.status,
      403,
    );
    assert.equal(
      (await api(demoOwner, "POST", "/settings/seed-demo-data", { clerkUserId: demoEmployee })).response.status,
      400,
    );

    const seeded = await api(demoOwner, "POST", "/settings/seed-demo-data", {});
    assert.equal(seeded.response.status, 201);
    assert.deepEqual(seeded.json.counts, {
      customers: 5,
      materials: 10,
      quotes: 4,
      masterProjects: 1,
    });
    createdCustomerIds.push(...seeded.json.customerIds);
    createdMaterialIds.push(...seeded.json.materialIds);
    createdQuoteIds.push(...seeded.json.quoteIds);
    createdProjectIds.push(seeded.json.masterProjectId);

    const customerScope = await pool.query(
      "SELECT count(*)::int AS count FROM customers WHERE clerk_user_id = $1 AND id = ANY($2::int[])",
      [demoOwner, seeded.json.customerIds],
    );
    assert.equal(customerScope.rows[0].count, 5);
    const materialScope = await pool.query(
      "SELECT count(*)::int AS count FROM materials WHERE clerk_user_id = $1 AND id = ANY($2::int[])",
      [demoOwner, seeded.json.materialIds],
    );
    assert.equal(materialScope.rows[0].count, 10);
    const quoteScope = await pool.query(
      "SELECT status, master_project_id FROM quotes WHERE clerk_user_id = $1 AND id = ANY($2::int[]) ORDER BY status",
      [demoOwner, seeded.json.quoteIds],
    );
    assert.deepEqual(
      quoteScope.rows.map(({ status }) => status).sort(),
      ["accepted", "draft", "rejected", "sent"],
    );
    assert.equal(
      quoteScope.rows.filter(({ master_project_id }) => master_project_id === seeded.json.masterProjectId).length,
      2,
    );
    const projectScope = await pool.query(
      `SELECT count(*)::int AS count
         FROM master_projects mp
         JOIN customers c ON c.id = mp.customer_id
        WHERE mp.id = $1 AND c.clerk_user_id = $2`,
      [seeded.json.masterProjectId, demoOwner],
    );
    assert.equal(projectScope.rows[0].count, 1);

    const foreignCustomers = await api(demoEmployee, "GET", "/customers");
    assert.ok(foreignCustomers.json.every(({ id }) => !seeded.json.customerIds.includes(id)));
    const foreignQuotes = await api(demoEmployee, "GET", "/quotes");
    assert.ok(foreignQuotes.json.every(({ id }) => !seeded.json.quoteIds.includes(id)));

    const duplicate = await api(demoOwner, "POST", "/settings/seed-demo-data", {});
    assert.equal(duplicate.response.status, 409);
    assert.equal(duplicate.json.code, "DEMO_SEED_EXISTS");
  } finally {
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
  }
});

test("database-backed customer and nested route isolation", { skip: !hasDatabase }, async () => {
  await pool.query("UPDATE business_profiles SET role = 'Owner' WHERE clerk_user_id = $1", [userA]);
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
  assert.match(quote.json.portalToken, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(
    quote.json.complianceDisclaimer.startsWith(
      "All specified works conform to the current Australian National Construction Code (NCC) and relevant Australian Standards (AS).",
    ),
    true,
  );
  assert.equal(quote.json.complianceDisclaimer.includes("Primary trade classification: Builder."), true);
  assert.equal(quote.json.contractorLicenseNumber, "QBCC 7654321");
  createdQuoteIds.push(quote.json.id);

  assert.equal(
    (await api(null, "GET", `/quotes/${quote.json.id}/pdf`)).response.status,
    401,
  );
  assert.equal(
    (await api(userB, "GET", `/quotes/${quote.json.id}/pdf`)).response.status,
    404,
  );
  const quotePdf = await api(userA, "GET", `/quotes/${quote.json.id}/pdf`);
  assert.equal(quotePdf.response.status, 200);
  assert.equal(
    quotePdf.response.headers.get("content-type"),
    "application/pdf",
  );
  assert.equal(
    new TextDecoder()
      .decode((await quotePdf.response.arrayBuffer()).slice(0, 4)),
    "%PDF",
  );

  const customQuote = await api(userA, "POST", "/quotes", {
    title: `${fixture}-custom-line-items-quote`,
    customerId: quoteCustomer.json.id,
    lengthM: 3,
    widthM: 2,
    labourHours: 10,
    labourRate: 100,
    lineItems: [
      {
        description: "Skip bin hire",
        quantity: 2,
        unitCost: 100,
        markupPercentage: 25,
      },
      {
        description: "Council permit",
        quantity: 1,
        unitCost: 300,
        markupPercentage: 0,
      },
    ],
  });
  assert.equal(customQuote.response.status, 201);
  createdQuoteIds.push(customQuote.json.id);
  assert.equal(customQuote.json.materialsSubtotal, quote.json.materialsSubtotal + 550);
  assert.equal(customQuote.json.gst, quote.json.gst + 55);
  assert.equal(customQuote.json.total, quote.json.total + 605);
  const savedCustomLines = customQuote.json.lineItems.filter((line) => line.category === "custom");
  assert.deepEqual(
    savedCustomLines.map((line) => ({
      description: line.description,
      quantity: line.quantity,
      unitCost: line.unitCost,
      markupPercentage: line.markupPercentage,
      lineTotal: line.lineTotal,
    })),
    [
      {
        description: "Skip bin hire",
        quantity: 2,
        unitCost: 100,
        markupPercentage: 25,
        lineTotal: 250,
      },
      {
        description: "Council permit",
        quantity: 1,
        unitCost: 300,
        markupPercentage: 0,
        lineTotal: 300,
      },
    ],
  );
  const persistedCustomLines = await pool.query(
    "SELECT material_id, category, unit_price, markup_percentage, line_total FROM quote_line_items WHERE quote_id = $1 AND category = 'custom' ORDER BY id",
    [customQuote.json.id],
  );
  assert.equal(persistedCustomLines.rowCount, 2);
  assert.equal(persistedCustomLines.rows.every((line) => line.material_id === null), true);
  assert.equal(Number(persistedCustomLines.rows[0].markup_percentage), 25);
  assert.equal(savedCustomLines[0].unitPrice, 125);

  const updatedCustomQuote = await api(userA, "PATCH", `/quotes/${customQuote.json.id}`, {
    notes: "Owner edit must preserve additional charges",
  });
  assert.equal(updatedCustomQuote.response.status, 200);
  assert.equal(
    updatedCustomQuote.json.lineItems.filter((line) => line.category === "custom").length,
    2,
  );
  assert.equal(updatedCustomQuote.json.total, customQuote.json.total);

  const portalUpdatedCustomQuote = await api(
    null,
    "PATCH",
    `/quote/${customQuote.json.portalToken}`,
    { deckBoardType: "composite" },
  );
  assert.equal(portalUpdatedCustomQuote.response.status, 200);
  for (const line of portalUpdatedCustomQuote.json.lineItems) {
    assert.equal("unitCost" in line, false);
    assert.equal("markupPercentage" in line, false);
  }
  assert.equal(
    portalUpdatedCustomQuote.json.lineItems.filter((line) => line.category === "custom").length,
    2,
  );
  const portalCustomSubtotal = portalUpdatedCustomQuote.json.lineItems
    .filter((line) => line.category === "custom")
    .reduce((sum, line) => sum + line.lineTotal, 0);
  assert.equal(portalCustomSubtotal, 550);

  const variation = await api(userA, "POST", `/quotes/${customQuote.json.id}/variation`, {
    title: `${fixture}-custom-line-items-variation`,
  });
  assert.equal(variation.response.status, 201);
  createdQuoteIds.push(variation.json.id);
  assert.equal(
    variation.json.lineItems.filter((line) => line.category === "custom").length,
    2,
  );
  assert.equal(
    variation.json.lineItems
      .filter((line) => line.category === "custom")
      .reduce((sum, line) => sum + line.lineTotal, 0),
    550,
  );
  const acceptedCustomQuote = await api(
    null,
    "PATCH",
    `/quote/${customQuote.json.portalToken}/status`,
    { status: "accepted" },
  );
  assert.equal(acceptedCustomQuote.response.status, 200);
  for (const line of acceptedCustomQuote.json.lineItems) {
    assert.equal("unitCost" in line, false);
    assert.equal("markupPercentage" in line, false);
  }
  const acceptedTotal = acceptedCustomQuote.json.total;
  const acceptedSpec = acceptedCustomQuote.json.spec;
  const postAcceptanceUpdate = await api(
    null,
    "PATCH",
    `/quote/${customQuote.json.portalToken}`,
    { deckBoardType: "post-acceptance-change" },
  );
  assert.equal(postAcceptanceUpdate.response.status, 409);
  const unchangedAcceptedQuote = await api(
    null,
    "GET",
    `/quote/${customQuote.json.portalToken}`,
  );
  assert.equal(unchangedAcceptedQuote.json.total, acceptedTotal);
  assert.deepEqual(unchangedAcceptedQuote.json.spec, acceptedSpec);
  assert.equal(
    (await api(userA, "PATCH", `/quotes/${customQuote.json.id}/status`, { status: "draft" })).response.status,
    409,
  );
  assert.equal(
    (await api(userA, "PATCH", `/quotes/${customQuote.json.id}`, { notes: "reopen bypass" })).response.status,
    409,
  );
  const stillAcceptedQuote = await api(
    null,
    "GET",
    `/quote/${customQuote.json.portalToken}`,
  );
  assert.equal(stillAcceptedQuote.json.status, "accepted");
  assert.equal(stillAcceptedQuote.json.total, acceptedTotal);

  const preciseQuote = await api(userA, "POST", "/quotes", {
    title: `${fixture}-normalised-line-item-quote`,
    customerId: quoteCustomer.json.id,
    lengthM: 3,
    widthM: 2,
    lineItems: [{
      description: "Precision-safe item",
      quantity: 1.23456,
      unitCost: 1.999,
      markupPercentage: 12.345,
    }],
  });
  assert.equal(preciseQuote.response.status, 201);
  createdQuoteIds.push(preciseQuote.json.id);
  const preciseLine = preciseQuote.json.lineItems.find((line) => line.category === "custom");
  assert.equal(preciseLine.quantity, 1.235);
  assert.equal(preciseLine.unitCost, 2);
  assert.equal(preciseLine.markupPercentage, 12.35);
  const preciseOwnerUpdate = await api(userA, "PATCH", `/quotes/${preciseQuote.json.id}`, {
    notes: "Normalised values stay stable",
  });
  assert.equal(preciseOwnerUpdate.response.status, 200);
  assert.equal(
    preciseOwnerUpdate.json.lineItems.find((line) => line.category === "custom").lineTotal,
    preciseLine.lineTotal,
  );
  const precisePortalUpdate = await api(
    null,
    "PATCH",
    `/quote/${preciseQuote.json.portalToken}`,
    { deckBoardType: "hardwood" },
  );
  assert.equal(precisePortalUpdate.response.status, 200);
  assert.equal(
    precisePortalUpdate.json.lineItems.find((line) => line.category === "custom").lineTotal,
    preciseLine.lineTotal,
  );
  const [raceAcceptance, raceManagerUpdate] = await Promise.all([
    api(null, "PATCH", `/quote/${preciseQuote.json.portalToken}/status`, {
      status: "accepted",
    }),
    api(userA, "PATCH", `/quotes/${preciseQuote.json.id}`, {
      notes: "Concurrent owner update",
    }),
  ]);
  assert.equal(raceAcceptance.response.status, 200);
  assert.equal([200, 409].includes(raceManagerUpdate.response.status), true);
  const raceResult = await api(userA, "GET", `/quotes/${preciseQuote.json.id}`);
  assert.equal(raceResult.json.status, "accepted");
  assert.equal(
    (await api(userA, "PATCH", `/quotes/${preciseQuote.json.id}`, {
      notes: "Must remain locked",
    })).response.status,
    409,
  );

  for (const invalidLineItem of [
    { description: "", quantity: 1, unitCost: 10, markupPercentage: 0 },
    { description: "Bad quantity", quantity: 0, unitCost: 10, markupPercentage: 0 },
    { description: "Bad cost", quantity: 1, unitCost: -1, markupPercentage: 0 },
    { description: "Bad mark-up", quantity: 1, unitCost: 10, markupPercentage: -1 },
  ]) {
    const invalidQuote = await api(userA, "POST", "/quotes", {
      title: `${fixture}-invalid-line-item`,
      customerId: quoteCustomer.json.id,
      lengthM: 3,
      widthM: 2,
      lineItems: [invalidLineItem],
    });
    assert.equal(invalidQuote.response.status, 400);
  }

  const quoteB = await api(userB, "POST", "/quotes", {
    title: `${fixture}-user-b-secure-quote`,
    customerId: createdB.json.id,
    lengthM: 2,
    widthM: 2,
  });
  assert.equal(quoteB.response.status, 201);
  assert.match(quoteB.json.portalToken, /^[A-Za-z0-9_-]{43}$/);
  assert.notEqual(quoteB.json.portalToken, quote.json.portalToken);
  createdQuoteIds.push(quoteB.json.id);

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
  assert.equal((await api(null, "GET", `/quotes/${quote.json.id}/portal`)).response.status, 404);
  const publicPortal = await api(null, "GET", `/quote/${quote.json.portalToken}`);
  assert.equal(publicPortal.response.status, 200);
  assert.equal(publicPortal.json.id, quote.json.id);
  assert.equal(publicPortal.json.complianceDisclaimer, quote.json.complianceDisclaimer);
  assert.equal(publicPortal.json.contractorLicenseNumber, "QBCC 7654321");
  assert.equal(publicPortal.json.businessName, `${fixture} Carpentry Pty Ltd`);
  assert.equal(publicPortal.json.businessPhone, "+61 412 345 678");
  assert.equal(publicPortal.json.businessTradeType, "Builder");

  await pool.query(
    "UPDATE quotes SET compliance_disclaimer = NULL, contractor_license_number = NULL WHERE id = $1",
    [quote.json.id],
  );
  const legacyPortal = await api(null, "GET", `/quote/${quote.json.portalToken}`);
  assert.equal(legacyPortal.response.status, 200);
  assert.equal(legacyPortal.json.complianceDisclaimer.includes("Primary trade classification: Builder."), true);
  assert.equal(legacyPortal.json.contractorLicenseNumber, "QBCC 7654321");
  const upgraded = await api(null, "PATCH", `/quote/${quote.json.portalToken}`, {
    deckBoardType: "public-upgrade-fixture",
  });
  assert.equal(upgraded.response.status, 200);
  assert.equal(upgraded.json.spec.deckBoardType, "public-upgrade-fixture");
  assert.equal(
    (await api(null, "PATCH", `/quote/${quote.json.portalToken}/status`, { status: "accepted" })).response.status,
    200,
  );
  assert.equal(
    (await api(null, "GET", `/quote/${"Z".repeat(43)}`)).response.status,
    404,
  );
  assert.equal(
    (await api(null, "PATCH", `/quotes/${quote.json.id}`, { deckBoardType: "treated_pine" })).response.status,
    401,
  );

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

  assert.equal(
    (await api(userB, "POST", `/quotes/${quote.json.id}/portal-token`)).response.status,
    404,
  );
  const regenerated = await api(userA, "POST", `/quotes/${quote.json.id}/portal-token`);
  assert.equal(regenerated.response.status, 200);
  assert.match(regenerated.json.portalToken, /^[A-Za-z0-9_-]{43}$/);
  assert.notEqual(regenerated.json.portalToken, quote.json.portalToken);
  assert.equal((await api(null, "GET", `/quote/${quote.json.portalToken}`)).response.status, 404);
  assert.equal((await api(null, "GET", `/quote/${regenerated.json.portalToken}`)).response.status, 200);
  assert.equal(
    (await api(userA, "DELETE", `/quotes/${quote.json.id}/portal-token`)).response.status,
    200,
  );
  assert.equal((await api(null, "GET", `/quote/${regenerated.json.portalToken}`)).response.status, 404);
});

test("linked workers only receive assigned work, including profileless linked accounts", { skip: !hasDatabase }, async () => {
  for (const [userId, role, label] of [
    [assignmentOwner, "Owner", "assignment-owner"],
    [linkedWorker, "Subcontractor", "linked-worker"],
    [profilelessWorker, "Subcontractor", "profileless-worker"],
    [unlinkedWorker, "Subcontractor", "unlinked-worker"],
  ]) {
    const onboarding = await api(userId, "POST", "/onboarding", {
      businessName: `${fixture} ${label}`,
      phoneNumber: "+61 400 000 000",
      tradeType: "Builder",
      licenseNumber: `${label}-licence`,
      role,
    });
    assert.equal(onboarding.response.status, 201, `${label} onboarding`);
  }

  const customer = await api(assignmentOwner, "POST", "/customers", {
    name: `${fixture}-assigned-customer`,
  });
  assert.equal(customer.response.status, 201);
  createdCustomerIds.push(customer.json.id);

  const createQuote = async (title) => {
    const result = await api(assignmentOwner, "POST", "/quotes", {
      title,
      customerId: customer.json.id,
      lengthM: 3,
      widthM: 2,
      labourHours: 8,
      labourRate: 100,
    });
    assert.equal(result.response.status, 201, title);
    createdQuoteIds.push(result.json.id);
    assert.match(result.json.portalToken, /^[A-Za-z0-9_-]{43}$/);
    return result.json;
  };
  const quoteForLinkedWorker = await createQuote(`${fixture}-quote-linked`);
  const quoteForProfilelessWorker = await createQuote(`${fixture}-quote-profileless`);
  const unassignedQuote = await createQuote(`${fixture}-quote-unassigned`);

  const createBooking = async (title, quoteId, startAt) => {
    const result = await api(assignmentOwner, "POST", "/bookings", {
      title,
      customerId: customer.json.id,
      quoteId,
      startAt,
      endAt: new Date(new Date(startAt).getTime() + 60 * 60 * 1000).toISOString(),
    });
    assert.equal(result.response.status, 201, title);
    createdBookingIds.push(result.json.id);
    return result.json;
  };
  const bookingForLinkedWorker = await createBooking(
    `${fixture}-booking-linked`,
    quoteForLinkedWorker.id,
    "2030-02-01T09:00:00.000Z",
  );
  const bookingForProfilelessWorker = await createBooking(
    `${fixture}-booking-profileless`,
    quoteForProfilelessWorker.id,
    "2030-02-02T09:00:00.000Z",
  );
  const bookingForConcurrentAssignment = await createBooking(
    `${fixture}-booking-concurrent-assignment`,
    unassignedQuote.id,
    "2030-02-03T09:00:00.000Z",
  );

  const memberForLinkedWorker = await api(assignmentOwner, "POST", "/team", {
    name: `${fixture} Linked Worker`,
    role: "subcontractor",
  });
  assert.equal(memberForLinkedWorker.response.status, 201);
  createdMemberIds.push(memberForLinkedWorker.json.id);
  const linked = await api(
    assignmentOwner,
    "PUT",
    `/team/${memberForLinkedWorker.json.id}/account`,
    { accountUserId: linkedWorker },
  );
  assert.equal(linked.response.status, 200);
  assert.equal(linked.json.accountLinked, true);
  assert.equal(linked.json.accountUserId, linkedWorker);

  const memberForProfilelessWorker = await api(assignmentOwner, "POST", "/team", {
    name: `${fixture} Profileless Worker`,
    role: "subcontractor",
  });
  assert.equal(memberForProfilelessWorker.response.status, 201);
  createdMemberIds.push(memberForProfilelessWorker.json.id);
  const profilelessLink = await api(
    assignmentOwner,
    "PUT",
    `/team/${memberForProfilelessWorker.json.id}/account`,
    { accountUserId: profilelessWorker },
  );
  assert.equal(profilelessLink.response.status, 200);
  // A linked account must remain assignment-scoped even if its own business
  // profile is later removed. This models accounts linked before onboarding
  // was made mandatory and prevents profile state from becoming an access
  // boundary.
  await pool.query("DELETE FROM business_profiles WHERE clerk_user_id = $1", [profilelessWorker]);

  const assignmentForLinkedWorker = await api(
    assignmentOwner,
    "POST",
    `/team/${memberForLinkedWorker.json.id}/assign/${bookingForLinkedWorker.id}`,
    { roleOnJob: "Lead carpenter" },
  );
  assert.equal(assignmentForLinkedWorker.response.status, 201);
  const assignmentForProfilelessWorker = await api(
    assignmentOwner,
    "POST",
    `/team/${memberForProfilelessWorker.json.id}/assign/${bookingForProfilelessWorker.id}`,
    { roleOnJob: "Carpenter" },
  );
  assert.equal(assignmentForProfilelessWorker.response.status, 201);

  const raceBarrierClient = await pool.connect();
  let raceBarrierLocked = false;
  let pendingAssignments;
  let concurrentAssignments;
  try {
    await pool.query(`
      CREATE OR REPLACE FUNCTION job_assignment_race_barrier()
      RETURNS trigger
      LANGUAGE plpgsql
      AS $$
      BEGIN
        PERFORM pg_advisory_xact_lock_shared(NEW.job_id::bigint);
        RETURN NEW;
      END;
      $$
    `);
    await pool.query(`
      CREATE TRIGGER job_assignment_race_barrier
      BEFORE INSERT ON job_assignments
      FOR EACH ROW
      EXECUTE FUNCTION job_assignment_race_barrier()
    `);
    await raceBarrierClient.query(
      "SELECT pg_advisory_lock($1::bigint)",
      [bookingForConcurrentAssignment.id],
    );
    raceBarrierLocked = true;
    pendingAssignments = Promise.all([
      api(
        assignmentOwner,
        "POST",
        `/team/${memberForLinkedWorker.json.id}/assign/${bookingForConcurrentAssignment.id}`,
        { roleOnJob: "Lead carpenter" },
      ),
      api(
        assignmentOwner,
        "POST",
        `/team/${memberForLinkedWorker.json.id}/assign/${bookingForConcurrentAssignment.id}`,
        { roleOnJob: "Supervisor" },
      ),
    ]);
    const waitDeadline = Date.now() + 3_000;
    let waitingInsertCount = 0;
    while (Date.now() < waitDeadline && waitingInsertCount < 2) {
      const waiters = await pool.query(`
        SELECT count(*)::int AS count
        FROM pg_locks
        WHERE locktype = 'advisory'
          AND classid = 0
          AND objid = $1::oid
          AND objsubid = 1
          AND NOT granted
      `, [bookingForConcurrentAssignment.id]);
      waitingInsertCount = waiters.rows[0].count;
      if (waitingInsertCount < 2) {
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
    }
    assert.equal(waitingInsertCount, 2, "both assignment inserts reached the race barrier");
    await raceBarrierClient.query(
      "SELECT pg_advisory_unlock($1::bigint)",
      [bookingForConcurrentAssignment.id],
    );
    raceBarrierLocked = false;
    concurrentAssignments = await pendingAssignments;
  } finally {
    if (raceBarrierLocked) {
      await raceBarrierClient.query(
        "SELECT pg_advisory_unlock($1::bigint)",
        [bookingForConcurrentAssignment.id],
      );
    }
    if (pendingAssignments && !concurrentAssignments) {
      await Promise.allSettled([pendingAssignments]);
    }
    raceBarrierClient.release();
    await pool.query("DROP TRIGGER IF EXISTS job_assignment_race_barrier ON job_assignments");
    await pool.query("DROP FUNCTION IF EXISTS job_assignment_race_barrier()");
  }
  assert.deepEqual(
    concurrentAssignments.map(({ response }) => response.status).sort((a, b) => a - b),
    [201, 409],
  );
  assert.deepEqual(
    concurrentAssignments.find(({ response }) => response.status === 409).json,
    { error: "Already assigned" },
  );
  const concurrentAssignmentRows = await pool.query(
    "SELECT id FROM job_assignments WHERE job_id = $1 AND team_member_id = $2",
    [bookingForConcurrentAssignment.id, memberForLinkedWorker.json.id],
  );
  assert.equal(concurrentAssignmentRows.rowCount, 1);
  const removedConcurrentAssignment = await api(
    assignmentOwner,
    "DELETE",
    `/bookings/${bookingForConcurrentAssignment.id}/assignments`,
    { teamMemberId: memberForLinkedWorker.json.id },
  );
  assert.equal(removedConcurrentAssignment.response.status, 200);
  const removedConcurrentAssignmentRows = await pool.query(
    "SELECT id FROM job_assignments WHERE job_id = $1 AND team_member_id = $2",
    [bookingForConcurrentAssignment.id, memberForLinkedWorker.json.id],
  );
  assert.equal(removedConcurrentAssignmentRows.rowCount, 0);
  assert.equal(
    (await api(linkedWorker, "GET", `/time/job/${bookingForConcurrentAssignment.id}`)).response.status,
    404,
  );

  for (const [workerId, expectedMemberId] of [
    [linkedWorker, memberForLinkedWorker.json.id],
    [profilelessWorker, memberForProfilelessWorker.json.id],
  ]) {
    const access = await api(workerId, "GET", "/assignment-access");
    assert.equal(access.response.status, 200);
    assert.deepEqual(access.json, {
      linked: true,
      teamMemberId: expectedMemberId,
      role: "subcontractor",
    });
  }
  const profilelessProfile = await api(profilelessWorker, "GET", "/settings/profile");
  assert.equal(profilelessProfile.response.status, 404);
  const unlinkedAccess = await api(unlinkedWorker, "GET", "/assignment-access");
  assert.deepEqual(unlinkedAccess.json, { linked: false, teamMemberId: null, role: null });

  const ownerBookings = await api(assignmentOwner, "GET", "/bookings");
  assert.equal(ownerBookings.response.status, 200);
  assert.deepEqual(
    ownerBookings.json.map((booking) => booking.id).sort((a, b) => a - b),
    [
      bookingForLinkedWorker.id,
      bookingForProfilelessWorker.id,
      bookingForConcurrentAssignment.id,
    ].sort((a, b) => a - b),
  );
  const linkedBookings = await api(linkedWorker, "GET", "/bookings");
  assert.equal(linkedBookings.response.status, 200);
  assert.deepEqual(linkedBookings.json.map((booking) => booking.id), [bookingForLinkedWorker.id]);
  const profilelessBookings = await api(profilelessWorker, "GET", "/bookings");
  assert.equal(profilelessBookings.response.status, 200);
  assert.deepEqual(profilelessBookings.json.map((booking) => booking.id), [bookingForProfilelessWorker.id]);
  const unlinkedBookings = await api(unlinkedWorker, "GET", "/bookings");
  assert.equal(unlinkedBookings.response.status, 200);
  assert.deepEqual(unlinkedBookings.json, []);

  const assignQuote = async (quoteId, memberId) => {
    const result = await api(assignmentOwner, "PATCH", `/quotes/${quoteId}`, {
      assignedTeamMemberId: memberId,
    });
    assert.equal(result.response.status, 200);
    return result.json;
  };
  await assignQuote(quoteForLinkedWorker.id, memberForLinkedWorker.json.id);
  await assignQuote(quoteForProfilelessWorker.id, memberForProfilelessWorker.json.id);

  const ownerQuotes = await api(assignmentOwner, "GET", "/quotes");
  assert.equal(ownerQuotes.response.status, 200);
  assert.deepEqual(
    ownerQuotes.json.map((quote) => quote.id).sort((a, b) => a - b),
    createdQuoteIds.slice(-3).sort((a, b) => a - b),
  );
  const linkedQuotes = await api(linkedWorker, "GET", "/quotes");
  assert.equal(linkedQuotes.response.status, 200);
  assert.deepEqual(linkedQuotes.json.map((quote) => quote.id), [quoteForLinkedWorker.id]);
  const profilelessQuotes = await api(profilelessWorker, "GET", "/quotes");
  assert.equal(profilelessQuotes.response.status, 200);
  assert.deepEqual(profilelessQuotes.json.map((quote) => quote.id), [quoteForProfilelessWorker.id]);
  const unlinkedQuotes = await api(unlinkedWorker, "GET", "/quotes");
  assert.equal(unlinkedQuotes.response.status, 200);
  assert.deepEqual(unlinkedQuotes.json, []);

  for (const [workerId, assignedQuote, foreignQuote] of [
    [linkedWorker, quoteForLinkedWorker, quoteForProfilelessWorker],
    [profilelessWorker, quoteForProfilelessWorker, quoteForLinkedWorker],
  ]) {
    const detail = await api(workerId, "GET", `/quotes/${assignedQuote.id}`);
    assert.equal(detail.response.status, 200);
    assert.equal(detail.json.portalToken, null);
    assert.equal(detail.json.id, assignedQuote.id);
    assert.equal(
      (await api(workerId, "GET", `/quotes/${foreignQuote.id}`)).response.status,
      404,
    );
  }
  assert.equal(
    (await api(unlinkedWorker, "GET", `/quotes/${quoteForLinkedWorker.id}`)).response.status,
    404,
  );

  const photoPath = "/objects/uploads/not-owned/booking-photo.jpg";
  for (const workerId of [linkedWorker, profilelessWorker, unlinkedWorker]) {
    assert.equal(
      (await api(workerId, "POST", `/bookings/${bookingForLinkedWorker.id}/photos`, {
        objectPath: photoPath,
      })).response.status,
      403,
    );
    assert.equal(
      (await api(workerId, "DELETE", `/bookings/${bookingForLinkedWorker.id}/photos`, {
        objectPath: photoPath,
      })).response.status,
      403,
    );
    assert.equal(
      (await api(
        workerId,
        "POST",
        `/team/${memberForLinkedWorker.json.id}/assign/${bookingForProfilelessWorker.id}`,
        { roleOnJob: "Supervisor" },
      )).response.status,
      403,
    );
    assert.equal(
      (await api(
        workerId,
        "GET",
        `/bookings/${bookingForLinkedWorker.id}/assignments`,
      )).response.status,
      403,
    );
    assert.equal(
      (await api(
        workerId,
        "DELETE",
        `/bookings/${bookingForLinkedWorker.id}/assignments`,
        { teamMemberId: memberForLinkedWorker.json.id },
      )).response.status,
      403,
    );
    assert.equal(
      (await api(workerId, "GET", `/quotes/${quoteForLinkedWorker.id}/pdf`)).response.status,
      404,
    );
  }

  const bookingsAfterPhotoAttempts = await api(assignmentOwner, "GET", "/bookings");
  assert.equal(bookingsAfterPhotoAttempts.response.status, 200);
  assert.deepEqual(
    bookingsAfterPhotoAttempts.json.find(
      (booking) => booking.id === bookingForLinkedWorker.id,
    ).photos,
    [],
  );

  const addOwnerTime = async (teamMemberId, jobId, minuteOffset) => {
    const clockOn = new Date(Date.UTC(2030, 1, 3, 9, minuteOffset));
    const clockOff = new Date(clockOn.getTime() + 30 * 60 * 1000);
    const result = await api(assignmentOwner, "POST", "/time/manual", {
      teamMemberId,
      jobId,
      durationMinutes: 30,
      clockOn: clockOn.toISOString(),
      clockOff: clockOff.toISOString(),
      notes: `${fixture}-owner-time-${minuteOffset}`,
    });
    assert.equal(result.response.status, 201);
    return result.json;
  };

  const workerCases = [
    {
      workerId: linkedWorker,
      memberId: memberForLinkedWorker.json.id,
      bookingId: bookingForLinkedWorker.id,
      otherMemberId: memberForProfilelessWorker.json.id,
      otherBookingId: bookingForProfilelessWorker.id,
    },
    {
      workerId: profilelessWorker,
      memberId: memberForProfilelessWorker.json.id,
      bookingId: bookingForProfilelessWorker.id,
      otherMemberId: memberForLinkedWorker.json.id,
      otherBookingId: bookingForLinkedWorker.id,
    },
  ];

  for (const [index, worker] of workerCases.entries()) {
    const ownAssignedEntry = await addOwnerTime(
      worker.memberId,
      worker.bookingId,
      index * 3,
    );
    const otherMemberAssignedEntry = await addOwnerTime(
      worker.otherMemberId,
      worker.bookingId,
      index * 3 + 1,
    );
    const ownUnassignedEntry = await addOwnerTime(
      worker.memberId,
      worker.otherBookingId,
      index * 3 + 2,
    );

    const workerManualEntry = await api(worker.workerId, "POST", "/time/manual", {
      teamMemberId: worker.memberId,
      jobId: worker.bookingId,
      durationMinutes: 15,
      clockOn: "2030-02-04T09:00:00.000Z",
      clockOff: "2030-02-04T09:15:00.000Z",
      notes: `${fixture}-worker-manual`,
    });
    assert.equal(workerManualEntry.response.status, 201);

    const clockOn = await api(worker.workerId, "POST", "/time/clock-on", {
      teamMemberId: worker.memberId,
      jobId: worker.bookingId,
      notes: `${fixture}-worker-clock`,
    });
    assert.equal(clockOn.response.status, 201);
    const clockOff = await api(worker.workerId, "POST", "/time/clock-off", {
      teamMemberId: worker.memberId,
      jobId: worker.bookingId,
    });
    assert.equal(clockOff.response.status, 200);
    assert.equal(clockOff.json.id, clockOn.json.id);

    const jobEntries = await api(worker.workerId, "GET", `/time/job/${worker.bookingId}`);
    assert.equal(jobEntries.response.status, 200);
    assert.ok(jobEntries.json.some((entry) => entry.id === ownAssignedEntry.id));
    assert.ok(jobEntries.json.some((entry) => entry.id === workerManualEntry.json.id));
    assert.ok(jobEntries.json.every((entry) => entry.teamMemberId === worker.memberId));
    assert.ok(!jobEntries.json.some((entry) => entry.id === otherMemberAssignedEntry.id));

    const memberEntries = await api(
      worker.workerId,
      "GET",
      `/time/member/${worker.memberId}`,
    );
    assert.equal(memberEntries.response.status, 200);
    assert.ok(memberEntries.json.some((entry) => entry.id === ownAssignedEntry.id));
    assert.ok(memberEntries.json.every((entry) => entry.jobId === worker.bookingId));
    assert.ok(!memberEntries.json.some((entry) => entry.id === ownUnassignedEntry.id));

    assert.equal(
      (await api(worker.workerId, "GET", `/time/job/${worker.otherBookingId}`)).response.status,
      404,
    );
    assert.equal(
      (await api(worker.workerId, "GET", `/time/member/${worker.otherMemberId}`)).response.status,
      404,
    );
    assert.equal(
      (await api(worker.workerId, "POST", "/time/manual", {
        teamMemberId: worker.memberId,
        jobId: worker.otherBookingId,
        durationMinutes: 10,
      })).response.status,
      404,
    );
    assert.equal(
      (await api(worker.workerId, "POST", "/time/clock-on", {
        teamMemberId: worker.otherMemberId,
        jobId: worker.bookingId,
      })).response.status,
      404,
    );
  }

  for (const [method, pathname, body] of [
    ["POST", "/time/clock-on", {
      teamMemberId: memberForLinkedWorker.json.id,
      jobId: bookingForLinkedWorker.id,
    }],
    ["POST", "/time/clock-off", {
      teamMemberId: memberForLinkedWorker.json.id,
      jobId: bookingForLinkedWorker.id,
    }],
    ["POST", "/time/manual", {
      teamMemberId: memberForLinkedWorker.json.id,
      jobId: bookingForLinkedWorker.id,
      durationMinutes: 10,
    }],
    ["GET", `/time/job/${bookingForLinkedWorker.id}`, undefined],
    ["GET", `/time/member/${memberForLinkedWorker.json.id}`, undefined],
  ]) {
    assert.equal(
      (await api(unlinkedWorker, method, pathname, body)).response.status,
      404,
    );
  }

  const removedAssignment = await api(
    assignmentOwner,
    "DELETE",
    `/bookings/${bookingForLinkedWorker.id}/assignments`,
    { teamMemberId: memberForLinkedWorker.json.id },
  );
  assert.equal(removedAssignment.response.status, 200);
  assert.equal(
    (await api(linkedWorker, "GET", `/time/job/${bookingForLinkedWorker.id}`)).response.status,
    404,
  );
  assert.equal(
    (await api(linkedWorker, "POST", "/time/manual", {
      teamMemberId: memberForLinkedWorker.json.id,
      jobId: bookingForLinkedWorker.id,
      durationMinutes: 10,
    })).response.status,
    404,
  );
  const removedAssignmentRows = await pool.query(
    "SELECT id FROM job_assignments WHERE job_id = $1 AND team_member_id = $2",
    [bookingForLinkedWorker.id, memberForLinkedWorker.json.id],
  );
  assert.equal(removedAssignmentRows.rowCount, 0);

  const unlinked = await api(
    assignmentOwner,
    "DELETE",
    `/team/${memberForProfilelessWorker.json.id}/account`,
  );
  assert.equal(unlinked.response.status, 200);
  assert.equal(
    (await api(
      profilelessWorker,
      "GET",
      `/time/member/${memberForProfilelessWorker.json.id}`,
    )).response.status,
    404,
  );
  assert.equal(
    (await api(profilelessWorker, "POST", "/time/clock-on", {
      teamMemberId: memberForProfilelessWorker.json.id,
      jobId: bookingForProfilelessWorker.id,
    })).response.status,
    404,
  );
});
