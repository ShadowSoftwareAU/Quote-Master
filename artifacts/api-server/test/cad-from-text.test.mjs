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
