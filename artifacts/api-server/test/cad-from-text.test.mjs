import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";

const testDirectory = dirname(fileURLToPath(import.meta.url));
const cadServiceFile = resolve(testDirectory, "../src/services/cadFromText.ts");
const cadSchemaFile = resolve(
  testDirectory,
  "../../../lib/api-zod/src/cad-layout.ts",
);
const complianceServiceFile = resolve(
  testDirectory,
  "../src/services/cadCompliance.ts",
);
const outputDirectory = `/tmp/quote-master-cad-test-${process.pid}`;
const entryFile = `${outputDirectory}/entry.ts`;
const bundleFile = `${outputDirectory}/bundle.mjs`;
let cadModule;

before(async () => {
  await mkdir(outputDirectory, { recursive: true });
  await writeFile(
    entryFile,
    [
      `export { simulateCadFromText } from ${JSON.stringify(cadServiceFile)};`,
      `export { evaluateCadLayoutCompliance } from ${JSON.stringify(complianceServiceFile)};`,
      `export { CadLayoutPayloadSchema } from ${JSON.stringify(cadSchemaFile)};`,
    ].join("\n"),
  );
  await build({
    entryPoints: [entryFile],
    bundle: true,
    platform: "node",
    format: "esm",
    outfile: bundleFile,
    logLevel: "silent",
  });
  cadModule = await import(pathToFileURL(bundleFile).href);
});

after(async () => {
  await rm(outputDirectory, { recursive: true, force: true });
});

test("simulated CAD parsing is deterministic and recognises each trade", () => {
  const fallback = { lengthM: 5, widthM: 6, heightM: 0.6 };
  const first = cadModule.simulateCadFromText(
    "3x4m timber deck with handrails",
    fallback,
  );

  assert.deepEqual(
    first,
    cadModule.simulateCadFromText("3x4m timber deck with handrails", fallback),
  );
  assert.equal(first.tradeCategory, "carpentry");
  assert.equal(first.units, "metres");
  assert.equal(first.coordinateSystem, "right-handed-y-up");
  assert.deepEqual(first.dimensions, { x: 3, y: 0.6, z: 4 });
  assert.deepEqual(first.structuralComponents[0].dimensions, {
    x: 3,
    y: 0.14,
    z: 0.045,
  });
  assert.deepEqual(first.structuralComponents[0].position, {
    x: 1.5,
    y: 0.6,
    z: 2,
  });
  assert.deepEqual(first.structuralComponents[1].dimensions, {
    x: 0.09,
    y: 0.045,
    z: 4,
  });
  assert.deepEqual(first.structuralComponents[1].position, {
    x: 1.5,
    y: 0.6,
    z: 2,
  });
  assert.equal(
    cadModule.simulateCadFromText("4x2m electrical conduit run", fallback)
      .tradeCategory,
    "electrical",
  );
  assert.equal(
    cadModule.simulateCadFromText("2x3m plumbing pipe layout", fallback)
      .tradeCategory,
    "plumbing",
  );
});

test("mixed service prompts retain components needed for separation checks", () => {
  const layout = cadModule.simulateCadFromText(
    "4x3m electrical outlet beside a plumbing water pipe",
    { lengthM: 5, widthM: 6, heightM: 2.4 },
  );

  assert.deepEqual(
    [...new Set(layout.structuralComponents.map((item) => item.tradeCategory))],
    ["electrical", "plumbing"],
  );
  assert(layout.structuralComponents.some((item) => item.type === "outlet"));
  assert(layout.structuralComponents.some((item) => item.type === "pipe"));
  assert.equal(cadModule.evaluateCadLayoutCompliance(layout).status, "pass");
});

test("strict CAD schema rejects unknown fields and invalid dimensions", () => {
  const valid = cadModule.simulateCadFromText("3x4m timber deck", {
    lengthM: 5,
    widthM: 6,
    heightM: 0.6,
  });

  assert.equal(
    cadModule.CadLayoutPayloadSchema.safeParse({
      ...valid,
      unexpected: true,
    }).success,
    false,
  );
  assert.equal(
    cadModule.CadLayoutPayloadSchema.safeParse({
      ...valid,
      dimensions: { x: -1, y: 4, z: 1 },
    }).success,
    false,
  );
});

test("unrepresentable zero dimensions fail before persistence", () => {
  assert.throws(
    () =>
      cadModule.simulateCadFromText("0x4m timber deck", {
        lengthM: 5,
        widthM: 6,
        heightM: 0.6,
      }),
    /could not be converted into a valid 3D layout/,
  );
});

test("CAD v1 compliance evaluation is deterministic and reports all standards", () => {
  const layout = cadModule.simulateCadFromText(
    "4x2x0.6m electrical conduit run",
    { lengthM: 5, widthM: 6, heightM: 0.6 },
  );
  const first = cadModule.evaluateCadLayoutCompliance(layout);

  assert.deepEqual(first, cadModule.evaluateCadLayoutCompliance(layout));
  assert.deepEqual(first.evaluatedStandards, [
    "NCC 2022",
    "AS 1684",
    "AS/NZS 3000",
    "AS/NZS 3500",
  ]);
  assert.equal(first.status, "pass");
  assert.deepEqual(first.findings, []);
});

test("CAD compliance distinguishes warnings from blocking findings", () => {
  const electrical = cadModule.simulateCadFromText(
    "4x2x0.6m electrical conduit run",
    { lengthM: 5, widthM: 6, heightM: 0.6 },
  );
  const warningLayout = structuredClone(electrical);
  warningLayout.structuralComponents[0].dimensions.y = 0.01;
  const warning = cadModule.evaluateCadLayoutCompliance(warningLayout);

  assert.equal(warning.status, "warning");
  assert.equal(warning.findings[0].severity, "warning");
  assert.equal(warning.findings[0].standard, "AS/NZS 3000");

  const blockedLayout = structuredClone(electrical);
  blockedLayout.structuralComponents =
    blockedLayout.structuralComponents.filter(({ type }) => type !== "outlet");
  const blocked = cadModule.evaluateCadLayoutCompliance(blockedLayout);

  assert.equal(blocked.status, "block");
  assert.equal(blocked.findings[0].severity, "block");
  assert.equal(blocked.findings[0].standard, "AS/NZS 3000");
});

test("CAD compliance applies NCC, timber and plumbing blocking rules", () => {
  const elevatedDeck = cadModule.simulateCadFromText(
    "3x4x1.2m timber deck",
    { lengthM: 3, widthM: 4, heightM: 1.2 },
  );
  assert.deepEqual(elevatedDeck.dimensions, { x: 3, y: 1.2, z: 4 });
  const deepButLowDeck = structuredClone(elevatedDeck);
  deepButLowDeck.dimensions = { x: 3, y: 0.6, z: 1.2 };
  assert.equal(
    cadModule
      .evaluateCadLayoutCompliance(deepButLowDeck)
      .findings.some(({ code }) => code === "NCC-2022-FALL-PROTECTION"),
    false,
  );
  const tallButShortMemberDeck = structuredClone(deepButLowDeck);
  tallButShortMemberDeck.structuralComponents[0].dimensions.y = 5.1;
  assert.equal(
    cadModule
      .evaluateCadLayoutCompliance(tallButShortMemberDeck)
      .findings.some(({ code }) => code === "AS1684-SPAN-REVIEW"),
    false,
  );
  const incompleteDeck = structuredClone(elevatedDeck);
  incompleteDeck.structuralComponents =
    incompleteDeck.structuralComponents.filter(({ type }) => type !== "joist");
  const deckEvaluation =
    cadModule.evaluateCadLayoutCompliance(incompleteDeck);

  assert.deepEqual(
    deckEvaluation.findings
      .filter(({ severity }) => severity === "block")
      .map(({ standard }) => standard),
    ["NCC 2022", "AS 1684"],
  );

  const plumbing = cadModule.simulateCadFromText(
    "2x3x0.6m plumbing pipe layout",
    { lengthM: 2, widthM: 3, heightM: 0.6 },
  );
  plumbing.structuralComponents = plumbing.structuralComponents.filter(
    ({ type }) => type !== "fitting",
  );
  const plumbingEvaluation =
    cadModule.evaluateCadLayoutCompliance(plumbing);

  assert.equal(plumbingEvaluation.status, "block");
  assert.equal(plumbingEvaluation.findings[0].standard, "AS/NZS 3500");
});
