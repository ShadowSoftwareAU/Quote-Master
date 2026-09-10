export const PARAMETRIC_ENGINE_VERSION = 1;
export const CABINET_FACE_DEPTH_FACTOR = 2;
export const STANDARD_DRAWERS_PER_BANK = 3;
export const BAR_CHAIR_BOX_COVERAGE_M2 = 20;
export const COMPOUND_BUCKET_COVERAGE_M2 = 100;
export const ROOF_SHEET_WASTAGE_FACTOR = 1.1;
export const ROOF_MAX_PITCH_DEGREES = 88;
export const ROOF_BATTEN_SPACING_M = 0.9;
export const ROOF_SCREWS_PER_M2 = 8;
export const ELECTRICAL_CABLE_ALLOWANCE_FACTOR = 1.1;
export const ELECTRICAL_CABLE_DRUM_LENGTH_M = 100;

export type ParameterDefinition = {
  id: string;
  label: string;
  unit: string;
  defaultValue: number;
  minimum?: number;
  maximum?: number;
  step?: number;
};

export type CustomParameterDefinition = ParameterDefinition;

export type CustomParameterSnapshot = {
  customParameterDefinitions: CustomParameterDefinition[];
  parameterValues: Record<string, number>;
};

export function hasMeaningfulCustomSnapshot(
  value: unknown,
): value is CustomParameterSnapshot {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const snapshot = value as Partial<CustomParameterSnapshot>;
  return Boolean(
    Array.isArray(snapshot.customParameterDefinitions) &&
    snapshot.customParameterDefinitions.length > 0 &&
    snapshot.parameterValues &&
    typeof snapshot.parameterValues === "object" &&
    !Array.isArray(snapshot.parameterValues),
  );
}

export enum BomRuleId {
  CabinetMelamineArea = "cabinet_melamine_area",
  CabinetHinges = "cabinet_hinges",
  CabinetRunners = "cabinet_runners",
  CabinetBenchtopArea = "cabinet_benchtop_area",
  DeckingLinearMetres = "decking_linear_metres",
  DeckJoistsLinearMetres = "deck_joists_linear_metres",
  DeckBearersLinearMetres = "deck_bearers_linear_metres",
  DeckPosts = "deck_posts",
  ConcreteVolume = "concrete_volume",
  ConcreteTrenchMesh = "concrete_trench_mesh",
  ConcreteSlabMesh = "concrete_slab_mesh",
  ConcreteBarChairBoxes = "concrete_bar_chair_boxes",
  PlasterWallBoard = "plaster_wall_board",
  PlasterCeilingBoard = "plaster_ceiling_board",
  PlasterCornice = "plaster_cornice",
  PlasterExternalAngle = "plaster_external_angle",
  PlasterInternalTape = "plaster_internal_tape",
  PlasterCompoundBuckets = "plaster_compound_buckets",
  RoofSheetArea = "roof_sheet_area",
  RoofBattens = "roof_battens",
  RoofGutter = "roof_gutter",
  RoofDownpipes = "roof_downpipes",
  RoofRidgeCapping = "roof_ridge_capping",
  RoofScrews = "roof_screws",
  ElectricalCableLength = "electrical_cable_length",
  ElectricalCableDrums = "electrical_cable_drums",
  ElectricalSingleFaceplates = "electrical_single_faceplates",
  ElectricalDoubleFaceplates = "electrical_double_faceplates",
  ElectricalMountingBlocks = "electrical_mounting_blocks",
  ElectricalLightFittings = "electrical_light_fittings",
}

export type BomRule = {
  lineKey: string;
  bomRuleId: BomRuleId;
};

export type ParametricTemplate = {
  engineVersion: number | null;
  templateRevision?: number | null;
  parameterDefinitions: ParameterDefinition[] | null;
  bomRules: BomRule[] | null;
};

export type CalculatedBomQuantity = {
  lineKey: string;
  bomRuleId: BomRuleId;
  quantity: number;
};

export type ParametricSnapshot = {
  templateId: number;
  templateSlug: string;
  engineVersion: number;
  templateRevision: number;
  parameterValues: Record<string, number>;
  parameterDefinitions: ParameterDefinition[];
  bomRules: BomRule[];
  customParameterDefinitions?: CustomParameterDefinition[];
  lineSnapshot?: ParametricLineSnapshot[];
  representationHistory?: ParametricRepresentationEvidence[];
};

export type ParametricLineSnapshot = {
  materialId?: number | null;
  lineKey: string;
  bomRuleId: BomRuleId;
  quantity: number;
  calculatedQuantity: number;
  isManualQuantity: boolean;
  unitCost: number;
  markupPercentage: number;
  description: string;
  category: string;
  unit: string;
  unitType: string;
  wastagePercentage: number;
  isBulkItem: boolean;
};

export type ParametricRepresentationEvidence = {
  representationVersion: number;
  transformedAt: string;
  transition: "public_decking_material_upgrade";
  deckBoardType: string;
  balustradeType: string;
  parameterValues: Record<string, number>;
  lineSnapshot: ParametricLineSnapshot[];
  materialsSubtotal: number;
  labourCost: number;
  gst: number;
  total: number;
};

export type ParametricTransformation = {
  snapshot: ParametricSnapshot;
  lines: ParametricLineSnapshot[];
};

export type ParametricLinePricingChange = {
  lineKey: string;
  materialId: number;
  description: string;
  unit: string;
  unitType: string;
  unitCost: number;
};

function cloneParametricLine(line: ParametricLineSnapshot): ParametricLineSnapshot {
  return { ...line };
}

export function cloneParametricSnapshot(
  snapshot: ParametricSnapshot,
): ParametricSnapshot {
  return {
    templateId: snapshot.templateId,
    templateSlug: snapshot.templateSlug,
    engineVersion: snapshot.engineVersion,
    templateRevision: snapshot.templateRevision,
    parameterValues: { ...snapshot.parameterValues },
    parameterDefinitions: snapshot.parameterDefinitions.map((item) => ({
      ...item,
    })),
    bomRules: snapshot.bomRules.map((item) => ({ ...item })),
    ...(snapshot.customParameterDefinitions
      ? {
          customParameterDefinitions: snapshot.customParameterDefinitions.map(
            (item) => ({ ...item }),
          ),
        }
      : {}),
    ...(snapshot.lineSnapshot
      ? { lineSnapshot: snapshot.lineSnapshot.map(cloneParametricLine) }
      : {}),
    ...(snapshot.representationHistory
      ? {
          representationHistory: snapshot.representationHistory.map(
            (evidence) => ({
              ...evidence,
              parameterValues: { ...evidence.parameterValues },
              lineSnapshot: evidence.lineSnapshot.map(cloneParametricLine),
            }),
          ),
        }
      : {}),
  };
}

export function transformParametricLinePricing(
  snapshot: ParametricSnapshot,
  pricingChanges: readonly ParametricLinePricingChange[],
  priorEvidence: Omit<
    ParametricRepresentationEvidence,
    "parameterValues" | "lineSnapshot" | "representationVersion"
  >,
): ParametricTransformation {
  if (snapshot.engineVersion !== PARAMETRIC_ENGINE_VERSION) {
    throw new Error("This quote uses an unsupported calculation engine version");
  }
  if (!snapshot.lineSnapshot?.length) {
    throw new Error(
      "This quote does not contain enough BOM evidence to transform safely",
    );
  }
  const changesByLineKey = new Map(
    pricingChanges.map((change) => [change.lineKey, change]),
  );
  if (
    changesByLineKey.size !== pricingChanges.length ||
    pricingChanges.some(
      (change) =>
        !Number.isFinite(change.unitCost) ||
        change.unitCost < 0 ||
        !snapshot.lineSnapshot?.some((line) => line.lineKey === change.lineKey),
    )
  ) {
    throw new Error("The requested material upgrade cannot be priced safely");
  }
  const lines = snapshot.lineSnapshot.map((line) => {
    const pricing = changesByLineKey.get(line.lineKey);
    return pricing
      ? {
          ...line,
          materialId: pricing.materialId,
          description: pricing.description,
          unit: pricing.unit,
          unitType: pricing.unitType,
          unitCost: pricing.unitCost,
        }
      : cloneParametricLine(line);
  });
  const history = snapshot.representationHistory ?? [];
  return {
    snapshot: {
      ...cloneParametricSnapshot(snapshot),
      lineSnapshot: lines,
      representationHistory: [
        ...history.map((evidence) => ({
          ...evidence,
          parameterValues: { ...evidence.parameterValues },
          lineSnapshot: evidence.lineSnapshot.map(cloneParametricLine),
        })),
        {
          ...priorEvidence,
          representationVersion: history.length + 1,
          parameterValues: { ...snapshot.parameterValues },
          lineSnapshot: snapshot.lineSnapshot.map(cloneParametricLine),
        },
      ],
    },
    lines,
  };
}

function effectiveQuantity(
  quantity: number,
  wastagePercentage: number,
  isBulkItem: boolean,
): number {
  const withWastage = quantity * (1 + wastagePercentage / 100);
  return isBulkItem
    ? Math.ceil(withWastage)
    : Math.round((withWastage + Number.EPSILON) * 1000) / 1000;
}

/**
 * Creates a new calculation representation from a quote's frozen template
 * revision. It never consults the current template and never changes manual
 * quantities.
 */
export function transformParametricSnapshot(
  snapshot: ParametricSnapshot,
  parameterChanges: Record<string, number>,
): ParametricTransformation {
  if (snapshot.engineVersion !== PARAMETRIC_ENGINE_VERSION) {
    throw new Error(
      "This quote uses an unsupported calculation engine version",
    );
  }
  if (!snapshot.lineSnapshot?.length) {
    throw new Error(
      "This quote does not contain enough BOM evidence to transform safely",
    );
  }
  const definitionIds = new Set(
    snapshot.parameterDefinitions.map(({ id }) => id),
  );
  const unsupported = Object.keys(parameterChanges).filter(
    (id) => !definitionIds.has(id),
  );
  if (unsupported.length > 0) {
    throw new Error(
      `This template does not support changing: ${unsupported.join(", ")}`,
    );
  }
  const parameterValues = validateParameterValues(
    snapshot.parameterDefinitions,
    {
      ...snapshot.parameterValues,
      ...parameterChanges,
    },
  );
  validateBomRules(
    snapshot.bomRules,
    snapshot.lineSnapshot.map(({ lineKey }) => lineKey),
  );
  const calculated = new Map(
    calculateTemplateBom(snapshot.bomRules, parameterValues).map((line) => [
      line.lineKey,
      line,
    ]),
  );
  const lines = snapshot.lineSnapshot.map((line) => {
    const next = calculated.get(line.lineKey);
    if (!next || next.bomRuleId !== line.bomRuleId) {
      throw new Error(
        `Stored BOM evidence is incomplete for line ${line.lineKey}`,
      );
    }
    return {
      ...line,
      calculatedQuantity: next.quantity,
      quantity: line.isManualQuantity
        ? line.quantity
        : effectiveQuantity(
            next.quantity,
            line.wastagePercentage,
            line.isBulkItem,
          ),
    };
  });
  return {
    snapshot: {
      ...cloneParametricSnapshot(snapshot),
      parameterValues,
      lineSnapshot: lines,
    },
    lines,
  };
}

function number(input: Record<string, number>, key: string): number {
  const value = input[key];
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function rounded(value: number): number {
  return Number.isFinite(value) && value > 0
    ? Math.round((value + Number.EPSILON) * 1000) / 1000
    : 0;
}

function roofSlopedArea(input: Record<string, number>): number {
  const pitch = Math.min(number(input, "pitchDegrees"), ROOF_MAX_PITCH_DEGREES);
  const cosine = Math.cos((pitch * Math.PI) / 180);
  return cosine > 0 ? number(input, "planRoofAreaM2") / cosine : 0;
}

function electricalCableLength(input: Record<string, number>): number {
  const points =
    number(input, "singleGpoCount") +
    number(input, "doubleGpoCount") +
    number(input, "lightFittingCount");
  return (
    points *
    number(input, "averageCableRunM") *
    ELECTRICAL_CABLE_ALLOWANCE_FACTOR
  );
}

export function calculateBomRule(
  rule: BomRuleId,
  input: Record<string, number>,
): number {
  const length = number(input, "lengthM");
  const width = number(input, "widthM");
  const wallLength = number(input, "wallLengthM");
  const ceilingHeight = number(input, "ceilingHeightM");
  const area = length * width;
  const perimeter = 2 * (length + width);
  const totalBoardArea =
    wallLength * ceilingHeight + number(input, "ceilingAreaM2");
  const bearerSpanM = number(input, "bearerSpanMm") / 1000;
  const bearerRows = bearerSpanM > 0 ? Math.ceil(length / bearerSpanM) + 1 : 0;

  switch (rule) {
    case BomRuleId.CabinetMelamineArea:
      return rounded(
        number(input, "totalCabinetRunM") *
          ((number(input, "baseCabinetHeightMm") +
            number(input, "overheadCabinetHeightMm")) /
            1000) *
          CABINET_FACE_DEPTH_FACTOR,
      );
    case BomRuleId.CabinetHinges:
      return rounded(number(input, "doorCount") * 2);
    case BomRuleId.CabinetRunners:
      return rounded(
        number(input, "drawerBankCount") * STANDARD_DRAWERS_PER_BANK,
      );
    case BomRuleId.CabinetBenchtopArea:
      return rounded(
        number(input, "totalCabinetRunM") *
          (number(input, "benchtopDepthMm") / 1000),
      );
    case BomRuleId.DeckingLinearMetres: {
      const boardWidthM = number(input, "boardWidthMm") / 1000;
      return rounded(boardWidthM > 0 ? area / boardWidthM : 0);
    }
    case BomRuleId.DeckJoistsLinearMetres: {
      const spacingM = number(input, "joistSpacingMm") / 1000;
      return rounded(
        spacingM > 0 ? (Math.ceil(width / spacingM) + 1) * length : 0,
      );
    }
    case BomRuleId.DeckBearersLinearMetres:
      return rounded(bearerSpanM > 0 ? bearerRows * width : 0);
    case BomRuleId.DeckPosts:
      return rounded(
        bearerSpanM > 0 ? bearerRows * (Math.ceil(width / bearerSpanM) + 1) : 0,
      );
    case BomRuleId.ConcreteVolume: {
      const slabThicknessM = number(input, "slabThicknessMm") / 1000;
      const edgeDepthExtraM = Math.max(
        number(input, "edgeBeamDepthMm") / 1000 - slabThicknessM,
        0,
      );
      return rounded(
        area * slabThicknessM +
          perimeter *
            (number(input, "edgeBeamWidthMm") / 1000) *
            edgeDepthExtraM,
      );
    }
    case BomRuleId.ConcreteTrenchMesh:
      return rounded(perimeter);
    case BomRuleId.ConcreteSlabMesh:
      return rounded(area);
    case BomRuleId.ConcreteBarChairBoxes:
      return rounded(
        area > 0 ? Math.ceil(area / BAR_CHAIR_BOX_COVERAGE_M2) : 0,
      );
    case BomRuleId.PlasterWallBoard:
      return rounded(wallLength * ceilingHeight);
    case BomRuleId.PlasterCeilingBoard:
      return rounded(number(input, "ceilingAreaM2"));
    case BomRuleId.PlasterCornice:
      return rounded(wallLength);
    case BomRuleId.PlasterExternalAngle:
      return rounded(number(input, "externalCornerCount") * ceilingHeight);
    case BomRuleId.PlasterInternalTape:
      return rounded(number(input, "internalCornerCount") * ceilingHeight);
    case BomRuleId.PlasterCompoundBuckets:
      return rounded(
        totalBoardArea > 0
          ? Math.ceil(totalBoardArea / COMPOUND_BUCKET_COVERAGE_M2)
          : 0,
      );
    case BomRuleId.RoofSheetArea:
      return rounded(roofSlopedArea(input) * ROOF_SHEET_WASTAGE_FACTOR);
    case BomRuleId.RoofBattens:
      return rounded(roofSlopedArea(input) / ROOF_BATTEN_SPACING_M);
    case BomRuleId.RoofGutter:
      return rounded(number(input, "gutterLengthM"));
    case BomRuleId.RoofDownpipes:
      return rounded(number(input, "downpipeCount"));
    case BomRuleId.RoofRidgeCapping:
      return rounded(number(input, "ridgeCappingLengthM"));
    case BomRuleId.RoofScrews:
      return rounded(Math.ceil(roofSlopedArea(input) * ROOF_SCREWS_PER_M2));
    case BomRuleId.ElectricalCableLength:
      return rounded(electricalCableLength(input));
    case BomRuleId.ElectricalCableDrums:
      return rounded(
        electricalCableLength(input) > 0
          ? Math.ceil(
              electricalCableLength(input) / ELECTRICAL_CABLE_DRUM_LENGTH_M,
            )
          : 0,
      );
    case BomRuleId.ElectricalSingleFaceplates:
      return rounded(number(input, "singleGpoCount"));
    case BomRuleId.ElectricalDoubleFaceplates:
      return rounded(number(input, "doubleGpoCount"));
    case BomRuleId.ElectricalMountingBlocks:
      return rounded(
        number(input, "singleGpoCount") + number(input, "doubleGpoCount"),
      );
    case BomRuleId.ElectricalLightFittings:
      return rounded(number(input, "lightFittingCount"));
  }
}

export function defaultParameterValues(
  definitions: readonly ParameterDefinition[] | null | undefined,
): Record<string, number> {
  return Object.fromEntries(
    (definitions ?? []).map((definition) => [
      definition.id,
      Number.isFinite(definition.defaultValue)
        ? Math.max(definition.minimum ?? 0, definition.defaultValue)
        : 0,
    ]),
  );
}

export function sanitiseParameterValues(
  definitions: readonly ParameterDefinition[],
  values: Record<string, unknown>,
): Record<string, number> {
  return Object.fromEntries(
    definitions.map((definition) => {
      const candidate = values[definition.id];
      const parsed =
        typeof candidate === "number"
          ? candidate
          : typeof candidate === "string"
            ? Number(candidate)
            : Number.NaN;
      const minimum = definition.minimum ?? 0;
      const maximum = definition.maximum ?? Number.MAX_SAFE_INTEGER;
      return [
        definition.id,
        Number.isFinite(parsed)
          ? Math.min(maximum, Math.max(minimum, parsed))
          : Math.min(maximum, Math.max(minimum, definition.defaultValue)),
      ];
    }),
  );
}

/** Strict boundary validation; unlike sanitiseParameterValues this never fills or clamps. */
export function validateParameterValues(
  definitions: readonly ParameterDefinition[],
  values: Record<string, unknown>,
): Record<string, number> {
  const definitionIds = definitions.map((definition) => definition.id);
  if (
    definitionIds.some((id) => !id) ||
    new Set(definitionIds).size !== definitionIds.length
  ) {
    throw new Error("Template parameter definitions contain duplicate keys");
  }
  const valueIds = Object.keys(values);
  if (
    valueIds.length !== definitionIds.length ||
    valueIds.some((id) => !definitionIds.includes(id))
  ) {
    throw new Error(
      "Parameter values must match the template definitions exactly",
    );
  }
  const result: Record<string, number> = {};
  for (const definition of definitions) {
    const value = values[definition.id];
    const minimum = definition.minimum ?? 0;
    const maximum = definition.maximum ?? Number.MAX_SAFE_INTEGER;
    if (
      typeof value !== "number" ||
      !Number.isFinite(value) ||
      value < minimum ||
      value > maximum
    ) {
      throw new Error(`Invalid value for parameter ${definition.id}`);
    }
    result[definition.id] = value;
  }
  return result;
}

export function validateBomRules(
  rules: readonly BomRule[],
  lineKeys: readonly string[],
): void {
  if (
    rules.length === 0 ||
    new Set(lineKeys).size !== lineKeys.length ||
    new Set(rules.map((rule) => rule.lineKey)).size !== rules.length ||
    rules.some(
      (rule) =>
        !lineKeys.includes(rule.lineKey) ||
        !Object.values(BomRuleId).includes(rule.bomRuleId),
    )
  ) {
    throw new Error("Template BOM rules do not match its line mappings");
  }
}

export function calculateTemplateBom(
  rules: readonly BomRule[] | null | undefined,
  parameterValues: Record<string, number>,
): CalculatedBomQuantity[] {
  return (rules ?? []).map((rule) => ({
    ...rule,
    quantity: calculateBomRule(rule.bomRuleId, parameterValues),
  }));
}

export function hasParametricDefinition(
  template: ParametricTemplate | null | undefined,
): boolean {
  return Boolean(
    template?.engineVersion === PARAMETRIC_ENGINE_VERSION &&
    template.parameterDefinitions?.length &&
    template.bomRules?.length,
  );
}

export const STANDARD_DIMENSION_FALLBACK: ParameterDefinition[] = [
  { id: "lengthM", label: "Length", unit: "m", defaultValue: 1, minimum: 0 },
  { id: "widthM", label: "Width", unit: "m", defaultValue: 1, minimum: 0 },
  { id: "heightM", label: "Height", unit: "m", defaultValue: 1, minimum: 0 },
];

export function createCustomParameterDefinition(
  ordinal: number,
): CustomParameterDefinition {
  return {
    id: `customVariable${Math.max(1, Math.trunc(ordinal))}`,
    label: "Custom variable",
    unit: "qty",
    defaultValue: 0,
    minimum: 0,
  };
}
