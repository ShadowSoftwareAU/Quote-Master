import {
  CadLayoutPayloadSchema,
  type ValidatedCadLayoutPayload,
} from "@workspace/api-zod";

interface QuoteDimensions {
  lengthM: number;
  widthM: number;
  heightM: number;
}

export class CadGenerationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CadGenerationError";
  }
}

const DIMENSION_PATTERN =
  /(\d+(?:\.\d+)?)\s*(?:m(?:etres?)?)?\s*[x×]\s*(\d+(?:\.\d+)?)\s*(?:m(?:etres?)?)?(?:\s*[x×]\s*(\d+(?:\.\d+)?)\s*(?:m(?:etres?)?)?)?/i;

function roundMetres(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function detectTradeCategory(
  prompt: string,
): ValidatedCadLayoutPayload["tradeCategory"] {
  const normalised = prompt.toLowerCase();
  if (/(electrical|electrician|wiring|cable|conduit|power|switch)/.test(normalised)) {
    return "electrical";
  }
  if (/(plumbing|plumber|pipe|drain|water|tap|fixture)/.test(normalised)) {
    return "plumbing";
  }
  return "carpentry";
}

function resolveDimensions(
  prompt: string,
  fallback: QuoteDimensions,
): ValidatedCadLayoutPayload["dimensions"] {
  const match = prompt.match(DIMENSION_PATTERN);
  return {
    x: roundMetres(match ? Number(match[1]) : fallback.lengthM),
    y: roundMetres(match ? Number(match[2]) : fallback.widthM),
    z: roundMetres(match?.[3] ? Number(match[3]) : Math.max(fallback.heightM, 0.1)),
  };
}

function buildComponents(
  tradeCategory: ValidatedCadLayoutPayload["tradeCategory"],
  dimensions: ValidatedCadLayoutPayload["dimensions"],
): ValidatedCadLayoutPayload["structuralComponents"] {
  const zero = { x: 0, y: 0, z: 0 };

  if (tradeCategory === "electrical") {
    return [
      {
        id: "electrical-conduit-1",
        name: "Primary electrical conduit",
        type: "conduit",
        tradeCategory,
        material: "Heavy-duty PVC electrical conduit",
        materialSku: null,
        geometryId: "electrical-conduit-linear-v1",
        dimensions: { x: dimensions.x, y: 0.025, z: 0.025 },
        position: { x: dimensions.x / 2, y: 0, z: dimensions.z / 2 },
        rotation: zero,
      },
      {
        id: "electrical-junction-box-1",
        name: "Junction box",
        type: "junction-box",
        tradeCategory,
        material: "Weather-resistant polymer",
        materialSku: null,
        geometryId: "electrical-junction-box-v1",
        dimensions: { x: 0.15, y: 0.15, z: 0.08 },
        position: { x: dimensions.x, y: 0, z: dimensions.z / 2 },
        rotation: zero,
      },
    ];
  }

  if (tradeCategory === "plumbing") {
    return [
      {
        id: "plumbing-pipe-1",
        name: "Primary water pipe",
        type: "pipe",
        tradeCategory,
        material: "Copper tube",
        materialSku: null,
        geometryId: "plumbing-pipe-linear-v1",
        dimensions: { x: dimensions.x, y: 0.02, z: 0.02 },
        position: { x: dimensions.x / 2, y: 0, z: dimensions.z / 2 },
        rotation: zero,
      },
      {
        id: "plumbing-fitting-1",
        name: "Terminal fitting",
        type: "fitting",
        tradeCategory,
        material: "Brass",
        materialSku: null,
        geometryId: "plumbing-terminal-fitting-v1",
        dimensions: { x: 0.05, y: 0.05, z: 0.05 },
        position: { x: dimensions.x, y: 0, z: dimensions.z / 2 },
        rotation: zero,
      },
    ];
  }

  return [
    {
      id: "carpentry-beam-1",
      name: "Primary bearer",
      type: "beam",
      tradeCategory,
      material: "H3 treated pine",
      materialSku: null,
      geometryId: "carpentry-bearer-linear-v1",
      dimensions: { x: dimensions.x, y: 0.14, z: 0.045 },
      position: { x: dimensions.x / 2, y: 0, z: dimensions.z },
      rotation: zero,
    },
    {
      id: "carpentry-joist-1",
      name: "Primary joist",
      type: "joist",
      tradeCategory,
      material: "H3 treated pine",
      materialSku: null,
      geometryId: "carpentry-joist-linear-v1",
      dimensions: { x: 0.09, y: dimensions.y, z: 0.045 },
      position: { x: dimensions.x / 2, y: dimensions.y / 2, z: dimensions.z },
      rotation: zero,
    },
  ];
}

export function simulateCadFromText(
  prompt: string,
  quoteDimensions: QuoteDimensions,
): ValidatedCadLayoutPayload {
  const tradeCategory = detectTradeCategory(prompt);
  const dimensions = resolveDimensions(prompt, quoteDimensions);

  const result = CadLayoutPayloadSchema.safeParse({
    version: 1,
    units: "metres",
    coordinateSystem: "right-handed-y-up",
    rotationUnit: "radians",
    tradeCategory,
    dimensions,
    origin: { x: 0, y: 0, z: 0 },
    structuralComponents: buildComponents(tradeCategory, dimensions),
  });

  if (!result.success) {
    throw new CadGenerationError(
      "The prompt could not be converted into a valid 3D layout",
    );
  }

  return result.data;
}