import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => readFile(path.join(root, relative), "utf8");

test("demo seed stays development-only and Owner-protected", async () => {
  const route = await read("src/routes/demo-seed.ts");
  assert.match(route, /process\.env\.NODE_ENV !== "development"/);
  assert.match(route, /router\.post\([\s\S]*developmentOnly,[\s\S]*requireOwner,/);
  assert.match(route, /getAuthenticatedClerkUserId\(req\)/);
  assert.doesNotMatch(route, /req\.body\.clerkUserId/);
  assert.match(route, /Object\.keys\(req\.body\)\.length > 0/);
});

test("demo seed is transactional, scoped, repeatable, and complete", async () => {
  const route = await read("src/routes/demo-seed.ts");
  assert.match(route, /db\.transaction\(async \(tx\)/);
  assert.match(route, /eq\(customersTable\.clerkUserId, clerkUserId\)/);
  assert.match(route, /clerkUserId,\s*\n\s*title: quote\.title/);
  assert.match(route, /DEMO_SEED_EXISTS/);

  const customerNames = route.match(/\n\s+name: "[^"]+"/g) ?? [];
  assert.equal(customerNames.length, 5);
  assert.match(route, /customerFixtures\.map\(\(customer\) => \(\{ \.\.\.customer, clerkUserId \}\)\)/);
  assert.match(route, /String\(index \+ 1\)\.padStart/);
  assert.match(route, /const materialFixtures = \[[\s\S]*\]\.map/);

  for (const status of ["draft", "sent", "accepted", "rejected"]) {
    assert.match(route, new RegExp(`status: "${status}"`));
  }
  assert.match(route, /inArray\(quotesTable\.id, \[quotes\[0\]\.id, quotes\[1\]\.id\]\)/);
  assert.match(route, /recalculateMasterProjectTotals\(project\.id, clerkUserId, tx\)/);
  assert.match(route, /customers: result\.customerIds\.length/);
  assert.match(route, /materials: result\.materialIds\.length/);
  assert.match(route, /quotes: result\.quoteIds\.length/);
  assert.match(route, /masterProjects: 1/);
});

test("generated clients and both settings screens expose Owner-only feedback", async () => {
  const [contract, client, web, mobile] = await Promise.all([
    read("../../lib/api-spec/openapi.yaml"),
    read("../../lib/api-client-react/src/generated/api.ts"),
    read("../deck-me/src/pages/settings-profile.tsx"),
    read("../deck-me-mobile/app/settings/profile.tsx"),
  ]);
  assert.match(contract, /\/dev\/seed-demo-data:/);
  assert.match(contract, /operationId: seedDemoData/);
  assert.match(client, /export const useSeedDemoData/);
  assert.match(client, /\/api\/dev\/seed-demo-data/);
  for (const screen of [web, mobile]) {
    assert.match(screen, /profile\?\.role === "Owner"/);
    assert.match(screen, /seedDemoData\.isPending/);
    assert.match(screen, /apiError\.status === 409/);
    assert.match(screen, /Seed Demo Data|SEED DEMO DATA/);
  }
});

test("seeded quote lines keep unit and bulk calculation metadata", async () => {
  const route = await read("src/routes/demo-seed.ts");
  assert.match(route, /calculateRequiredQuantity\(quantity, wastagePercentage, isBulkItem\)/);
  assert.match(route, /unitType,/);
  assert.match(route, /wastagePercentage: money\(wastagePercentage\)/);
  assert.match(route, /isBulkItem,/);
});