import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const apiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => readFile(path.resolve(apiRoot, relative), "utf8");

test("web and mobile keep the same preview total formula as quote persistence", async () => {
  const [web, mobile, route] = await Promise.all([
    read("../deck-me/src/pages/calculator.tsx"),
    read("../deck-me-mobile/app/quote/new.tsx"),
    read("src/routes/quotes.ts"),
  ]);

  for (const client of [web, mobile]) {
    assert.match(client, /previewLabourCost/);
    assert.match(client, /quoteSubtotal[\s\S]*materialsSubtotal[\s\S]*previewLabourCost[\s\S]*(customSubtotal|lineItemsSubtotal)/);
    assert.match(client, /quoteGst\s*=\s*Math\.round\(quoteSubtotal \* 0\.1 \* 100\) \/ 100/);
    assert.match(client, /quoteTotal\s*=\s*Math\.round\(\(quoteSubtotal \+ quoteGst\) \* 100\) \/ 100/);
    assert.match(client, /labourHours:/);
    assert.match(client, /labourRate:/);
  }

  assert.match(route, /calcTotals\(\{\s*materialsSubtotal,\s*labourHours,\s*labourRate,/);
});

test("both builders preserve calculated template identity and manual overrides", async () => {
  const [web, mobile] = await Promise.all([
    read("../deck-me/src/pages/calculator.tsx"),
    read("../deck-me-mobile/app/quote/new.tsx"),
  ]);

  for (const client of [web, mobile]) {
    assert.match(client, /setLineItems\(\[\]\)/, "switching templates must replace prior lines");
    assert.match(client, /field === "quantity"[\s\S]*isManualQuantity\s*=\s*true/);
    assert.match(client, /handleRestoreAutoQuantity/);
    assert.match(client, /isManualQuantity:\s*false/);
    assert.match(client, /lineKey:/);
    assert.match(client, /bomRuleId:/);
    assert.match(client, /parameterValues/);
  }
});

test("template-owned BOM fields stay read-only in web and mobile", async () => {
  const [web, mobile] = await Promise.all([
    read("../deck-me/src/pages/calculator.tsx"),
    read("../deck-me-mobile/app/quote/new.tsx"),
  ]);

  assert.match(web, /Template-owned/);
  assert.match(web, /item\.lineKey && item\.bomRuleId \? \([\s\S]*Template-owned/);
  assert.match(web, /item\.wastagePercentage\}% · Template-owned/);
  assert.match(mobile, /item\.lineKey && item\.bomRuleId \? \([\s\S]*Template-owned/);
  assert.match(mobile, /TEMPLATE-OWNED/);
  assert.match(mobile, /accessibilityLabel="Use calculated quantity"/);
});