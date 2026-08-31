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
const assignmentUsers = [assignmentOwner, linkedWorker, profilelessWorker, unlinkedWorker];
let tempDir;
let server;
let baseUrl;
let pool;
let processDueProfileMetadataJobs;
const createdCustomerIds = [];
const createdQuoteIds = [];
const createdProjectIds = [];
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
      await pool.query("DELETE FROM job_assignments WHERE job_id = ANY($1::int[])", [createdBookingIds]);
    }
    if (createdMemberIds.length) {
      await pool.query("DELETE FROM job_assignments WHERE team_member_id = ANY($1::int[])", [createdMemberIds]);
      await pool.query("DELETE FROM team_members WHERE id = ANY($1::int[])", [createdMemberIds]);
    }
    if (createdCustomerIds.length) {
      await pool.query("DELETE FROM bookings WHERE customer_id = ANY($1::int[])", [createdCustomerIds]);
    }
    await pool.query(
      "DELETE FROM profile_metadata_outbox WHERE clerk_user_id = ANY($1::text[])",
      [[userA, userB, ...assignmentUsers]],
    );
    await pool.query(
      "DELETE FROM business_profiles WHERE clerk_user_id = ANY($1::text[])",
      [[userA, userB, ...assignmentUsers]],
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
    [bookingForLinkedWorker.id, bookingForProfilelessWorker.id].sort((a, b) => a - b),
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
});
