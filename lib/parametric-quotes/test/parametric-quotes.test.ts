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
  transformParametricLinePricing,
  transformParametricSnapshot,
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
    {
      id: "length",
      label: "Length",
      unit: "m",
      defaultValue: 1,
      minimum: 0,
      maximum: 10,
    },
  ];
  assert.deepEqual(validateParameterValues(definitions, { length: 2 }), {
    length: 2,
  });
  assert.throws(() => validateParameterValues(definitions, {}));
  assert.throws(() =>
    validateParameterValues(definitions, { length: 2, other: 1 }),
  );
  assert.throws(() => validateParameterValues(definitions, { length: 11 }));
  assert.throws(() =>
    validateParameterValues(definitions, { length: Number.NaN }),
  );
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
    parameterDefinitions: [
      { id: "lengthM", label: "Length", unit: "m", defaultValue: 5 },
    ],
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

test("revision-aware transformations recalculate automatic lines and preserve overrides", () => {
  const baseLine = {
    bomRuleId: BomRuleId.DeckingLinearMetres,
    calculatedQuantity: 20,
    unitCost: 10,
    markupPercentage: 25,
    description: "Deck boards",
    category: "materials",
    unit: "metre",
    unitType: "lm",
    wastagePercentage: 10,
    isBulkItem: false,
  };
  const result = transformParametricSnapshot(
    {
      templateId: 7,
      templateSlug: "deck",
      engineVersion: 1,
      templateRevision: 3,
      parameterDefinitions: [
        { id: "lengthM", label: "Length", unit: "m", defaultValue: 2 },
        { id: "widthM", label: "Width", unit: "m", defaultValue: 1 },
        {
          id: "boardWidthMm",
          label: "Board width",
          unit: "mm",
          defaultValue: 100,
        },
      ],
      parameterValues: { lengthM: 2, widthM: 1, boardWidthMm: 100 },
      bomRules: [
        { lineKey: "automatic", bomRuleId: BomRuleId.DeckingLinearMetres },
        { lineKey: "manual", bomRuleId: BomRuleId.DeckingLinearMetres },
      ],
      lineSnapshot: [
        {
          ...baseLine,
          lineKey: "automatic",
          quantity: 22,
          isManualQuantity: false,
        },
        {
          ...baseLine,
          lineKey: "manual",
          quantity: 12,
          isManualQuantity: true,
        },
      ],
    },
    { lengthM: 3 },
  );
  assert.equal(result.snapshot.templateRevision, 3);
  assert.deepEqual(result.snapshot.parameterValues, {
    lengthM: 3,
    widthM: 1,
    boardWidthMm: 100,
  });
  assert.equal(result.lines[0].calculatedQuantity, 30);
  assert.equal(result.lines[0].quantity, 33);
  assert.equal(result.lines[1].quantity, 12);
  assert.equal(result.lines[1].calculatedQuantity, 30);
});

test("revision-aware transformations reject unsupported changes without mutation", () => {
  const snapshot = {
    templateId: 7,
    templateSlug: "deck",
    engineVersion: 1,
    templateRevision: 3,
    parameterDefinitions: [
      { id: "lengthM", label: "Length", unit: "m", defaultValue: 2 },
    ],
    parameterValues: { lengthM: 2 },
    bomRules: [{ lineKey: "boards", bomRuleId: BomRuleId.DeckingLinearMetres }],
    lineSnapshot: [
      {
        lineKey: "boards",
        bomRuleId: BomRuleId.DeckingLinearMetres,
        quantity: 1,
        calculatedQuantity: 1,
        isManualQuantity: false,
        unitCost: 1,
        markupPercentage: 0,
        description: "Boards",
        category: "materials",
        unit: "metre",
        unitType: "lm",
        wastagePercentage: 0,
        isBulkItem: false,
      },
    ],
  };
  assert.throws(
    () => transformParametricSnapshot(snapshot, { widthM: 4 }),
    /does not support changing: widthM/,
  );
  assert.deepEqual(snapshot.parameterValues, { lengthM: 2 });
});

test("material upgrades reprice one frozen BOM line and retain prior evidence", () => {
  const snapshot = {
    templateId: 7,
    templateSlug: "deck",
    engineVersion: 1,
    templateRevision: 3,
    parameterDefinitions: [
      { id: "lengthM", label: "Length", unit: "m", defaultValue: 2 },
      { id: "widthM", label: "Width", unit: "m", defaultValue: 1 },
      {
        id: "boardWidthMm",
        label: "Board width",
        unit: "mm",
        defaultValue: 100,
      },
    ],
    parameterValues: { lengthM: 2, widthM: 1, boardWidthMm: 100 },
    bomRules: [
      { lineKey: "decking", bomRuleId: BomRuleId.DeckingLinearMetres },
    ],
    lineSnapshot: [
      {
        lineKey: "decking",
        bomRuleId: BomRuleId.DeckingLinearMetres,
        quantity: 22,
        calculatedQuantity: 20,
        isManualQuantity: false,
        unitCost: 10,
        markupPercentage: 25,
        description: "Treated pine",
        category: "decking",
        unit: "metre",
        unitType: "lm",
        wastagePercentage: 10,
        isBulkItem: false,
      },
    ],
  };
  const result = transformParametricLinePricing(
    snapshot,
    [
      {
        lineKey: "decking",
        materialId: 42,
        description: "Composite decking",
        unit: "metre",
        unitType: "lm",
        unitCost: 18,
      },
    ],
    {
      transformedAt: "2026-09-09T12:00:00.000Z",
      transition: "public_decking_material_upgrade",
      deckBoardType: "treated_pine",
      balustradeType: "timber",
      materialsSubtotal: 275,
      labourCost: 100,
      gst: 37.5,
      total: 412.5,
    },
  );
  assert.equal(result.snapshot.templateRevision, 3);
  assert.deepEqual(result.snapshot.parameterValues, snapshot.parameterValues);
  assert.equal(result.lines[0].quantity, 22);
  assert.equal(result.lines[0].calculatedQuantity, 20);
  assert.equal(result.lines[0].bomRuleId, BomRuleId.DeckingLinearMetres);
  assert.equal(result.lines[0].unitCost, 18);
  assert.equal(result.lines[0].materialId, 42);
  assert.equal(result.snapshot.representationHistory?.length, 1);
  assert.equal(
    result.snapshot.representationHistory?.[0].lineSnapshot[0].unitCost,
    10,
  );
  assert.equal(snapshot.lineSnapshot[0].unitCost, 10);
});
