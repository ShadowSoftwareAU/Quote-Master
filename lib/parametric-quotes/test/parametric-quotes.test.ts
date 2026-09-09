import assert from "node:assert/strict";
import test from "node:test";
import {
  BomRuleId,
  calculateBomRule,
  calculateTemplateBom,
  createCustomParameterDefinition,
  defaultParameterValues,
  ROOF_MAX_PITCH_DEGREES,
  validateParameterValues,
  hasMeaningfulCustomSnapshot,
} from "../src/index.ts";

const calculate = (rule: BomRuleId, values: Record<string, number>) =>
  calculateBomRule(rule, values);

test("cabinet assembly quantities", () => {
  const input = {
    totalCabinetRunM: 4,
    baseCabinetHeightMm: 900,
    overheadCabinetHeightMm: 700,
    benchtopDepthMm: 600,
    drawerBankCount: 2,
    doorCount: 8,
  };
  assert.equal(calculate(BomRuleId.CabinetMelamineArea, input), 12.8);
  assert.equal(calculate(BomRuleId.CabinetHinges, input), 16);
  assert.equal(calculate(BomRuleId.CabinetRunners, input), 6);
  assert.equal(calculate(BomRuleId.CabinetBenchtopArea, input), 2.4);
});

test("deck assembly quantities and zero divisor guards", () => {
  const input = {
    lengthM: 5,
    widthM: 4,
    boardWidthMm: 100,
    joistSpacingMm: 500,
    bearerSpanMm: 2000,
  };
  assert.equal(calculate(BomRuleId.DeckingLinearMetres, input), 200);
  assert.equal(calculate(BomRuleId.DeckJoistsLinearMetres, input), 45);
  assert.equal(calculate(BomRuleId.DeckBearersLinearMetres, input), 16);
  assert.equal(calculate(BomRuleId.DeckPosts, input), 12);
  assert.equal(
    calculate(BomRuleId.DeckingLinearMetres, {
      ...input,
      boardWidthMm: 0,
    }),
    0,
  );
  assert.equal(
    calculate(BomRuleId.DeckPosts, { ...input, bearerSpanMm: Number.NaN }),
    0,
  );
});

test("concrete slab avoids double-counting the slab depth", () => {
  const input = {
    lengthM: 5,
    widthM: 4,
    slabThicknessMm: 100,
    edgeBeamDepthMm: 300,
    edgeBeamWidthMm: 300,
  };
  assert.equal(calculate(BomRuleId.ConcreteVolume, input), 3.08);
  assert.equal(calculate(BomRuleId.ConcreteTrenchMesh, input), 18);
  assert.equal(calculate(BomRuleId.ConcreteSlabMesh, input), 20);
  assert.equal(calculate(BomRuleId.ConcreteBarChairBoxes, input), 1);
});

test("plasterboard, corners and compound coverage", () => {
  const input = {
    wallLengthM: 30,
    ceilingHeightM: 2.4,
    ceilingAreaM2: 40,
    externalCornerCount: 3,
    internalCornerCount: 5,
  };
  assert.equal(calculate(BomRuleId.PlasterWallBoard, input), 72);
  assert.equal(calculate(BomRuleId.PlasterCeilingBoard, input), 40);
  assert.equal(calculate(BomRuleId.PlasterCornice, input), 30);
  assert.equal(calculate(BomRuleId.PlasterExternalAngle, input), 7.2);
  assert.equal(calculate(BomRuleId.PlasterInternalTape, input), 12);
  assert.equal(calculate(BomRuleId.PlasterCompoundBuckets, input), 2);
});

test("roof pitch is bounded and sheet wastage is applied once", () => {
  const ordinary = { pitchDegrees: 60, planRoofAreaM2: 100 };
  assert.equal(calculate(BomRuleId.RoofSheetArea, ordinary), 220);
  assert.equal(calculate(BomRuleId.RoofBattens, ordinary), 222.222);
  assert.equal(calculate(BomRuleId.RoofScrews, ordinary), 1600);
  assert.equal(
    calculate(BomRuleId.RoofSheetArea, {
      ...ordinary,
      pitchDegrees: 89,
    }),
    calculate(BomRuleId.RoofSheetArea, {
      ...ordinary,
      pitchDegrees: ROOF_MAX_PITCH_DEGREES,
    }),
  );
});

test("electrical points, allowance, drums and fittings", () => {
  const input = {
    singleGpoCount: 2,
    doubleGpoCount: 3,
    lightFittingCount: 5,
    averageCableRunM: 10,
  };
  assert.equal(calculate(BomRuleId.ElectricalCableLength, input), 110);
  assert.equal(calculate(BomRuleId.ElectricalCableDrums, input), 2);
  assert.equal(calculate(BomRuleId.ElectricalSingleFaceplates, input), 2);
  assert.equal(calculate(BomRuleId.ElectricalDoubleFaceplates, input), 3);
  assert.equal(calculate(BomRuleId.ElectricalMountingBlocks, input), 5);
  assert.equal(calculate(BomRuleId.ElectricalLightFittings, input), 5);
});

test("custom fallback is inert plain data", () => {
  const definition = createCustomParameterDefinition(2);
  assert.deepEqual(defaultParameterValues([definition]), {
    customVariable2: 0,
  });
});

test("template BOM mapping uses line keys, not descriptions", () => {
  assert.deepEqual(
    calculateTemplateBom(
      [
        {
          lineKey: "arbitrary-stable-key",
          bomRuleId: BomRuleId.CabinetHinges,
        },
      ],
      { doorCount: 3 },
    ),
    [
      {
        lineKey: "arbitrary-stable-key",
        bomRuleId: BomRuleId.CabinetHinges,
        quantity: 6,
      },
    ],
  );
});

test("strict parameter validation rejects missing, unknown and out-of-range values", () => {
  const definitions = [
    { id: "length", label: "Length", unit: "m", defaultValue: 1, minimum: 0, maximum: 10 },
  ];
  assert.deepEqual(validateParameterValues(definitions, { length: 2 }), {
    length: 2,
  });
  assert.throws(() => validateParameterValues(definitions, {}));
  assert.throws(() => validateParameterValues(definitions, { length: 2, other: 1 }));
  assert.throws(() => validateParameterValues(definitions, { length: 11 }));
  assert.throws(() => validateParameterValues(definitions, { length: Number.NaN }));
});

test("zero automatic outputs can be omitted without affecting manual validation", () => {
  const result = calculateTemplateBom(
    [{ lineKey: "posts", bomRuleId: BomRuleId.DeckPosts }],
    { lengthM: 2, widthM: 2, bearerSpanMm: 0 },
  );
  assert.equal(result[0].quantity, 0);
  assert.ok(result.every((line) => line.quantity >= 0));
});

test("parametric snapshots are immutable plain data and round-trip by value", () => {
  const snapshot = {
    templateId: 4,
    templateSlug: "slabs-footings",
    engineVersion: 1,
    templateRevision: 1,
    parameterValues: { lengthM: 5 },
    parameterDefinitions: [{ id: "lengthM", label: "Length", unit: "m", defaultValue: 5 }],
    bomRules: [{ lineKey: "concrete", bomRuleId: BomRuleId.ConcreteVolume }],
  };
  assert.deepEqual(JSON.parse(JSON.stringify(snapshot)), snapshot);
});

test("custom snapshots are meaningful only when variables are populated", () => {
  assert.equal(
    hasMeaningfulCustomSnapshot({
      customParameterDefinitions: [],
      parameterValues: {},
    }),
    false,
  );
  assert.equal(
    hasMeaningfulCustomSnapshot({
      customParameterDefinitions: [
        { id: "rooms", label: "Rooms", unit: "qty", defaultValue: 1 },
      ],
      parameterValues: { rooms: 2 },
    }),
    true,
  );
});