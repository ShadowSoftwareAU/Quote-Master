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

function detectTradeCategories(
  prompt: string,
): ValidatedCadLayoutPayload["tradeCategory"][] {
  const normalised = prompt.toLowerCase();
  const detected = [
    {
      trade: "carpentry" as const,
      index: normalised.search(
        /(carpentry|carpenter|timber|deck|beam|joist|wall|subframe)/,
      ),
    },
    {
      trade: "electrical" as const,
      index: normalised.search(
        /(electrical|electrician|wiring|cable|conduit|power|switch|outlet)/,
      ),
    },
    {
      trade: "plumbing" as const,
      index: normalised.search(
        /(plumbing|plumber|pipe|drain|water|tap|fixture)/,
      ),
    },
  ]
    .filter(({ index }) => index >= 0)
    .sort((first, second) => first.index - second.index)
    .map(({ trade }) => trade);

  return detected.length > 0 ? detected : ["carpentry"];
}

function resolveDimensions(
  prompt: string,
  fallback: QuoteDimensions,
): ValidatedCadLayoutPayload["dimensions"] {
  const match = prompt.match(DIMENSION_PATTERN);
  return {
    x: roundMetres(match ? Number(match[1]) : fallback.lengthM),
    y: roundMetres(
      match?.[3] ? Number(match[3]) : Math.max(fallback.heightM, 0.1),
    ),
    z: roundMetres(match ? Number(match[2]) : fallback.widthM),
  };
}

function buildComponents(
  tradeCategory: ValidatedCadLayoutPayload["tradeCategory"],
  dimensions: ValidatedCadLayoutPayload["dimensions"],
): ValidatedCadLayoutPayload["structuralComponents"] {
  const zero = { x: 0, y: 0, z: 0 };
  const serviceHeight = Math.min(Math.max(dimensions.y / 2, 0.1), 1.1);

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
        position: {
          x: dimensions.x / 2,
          y: serviceHeight,
          z: dimensions.z / 2,
        },
        rotation: zero,
      },
      {
        id: "electrical-outlet-1",
        name: "Power outlet",
        type: "outlet",
        tradeCategory,
        material: "Weather-resistant polymer",
        materialSku: null,
        geometryId: "electrical-outlet-v1",
        dimensions: { x: 0.12, y: 0.12, z: 0.06 },
        position: {
          x: Math.max(dimensions.x - 0.1, 0),
          y: serviceHeight,
          z: dimensions.z / 2,
        },
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
        position: {
          x: dimensions.x / 2,
          y: Math.max(serviceHeight - 0.2, 0),
          z: dimensions.z / 2,
        },
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
        position: {
          x: dimensions.x,
          y: Math.max(serviceHeight - 0.2, 0),
          z: dimensions.z / 2,
        },
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
      position: {
        x: dimensions.x / 2,
        y: dimensions.y,
        z: dimensions.z / 2,
      },
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
      dimensions: { x: 0.09, y: 0.045, z: dimensions.z },
      position: {
        x: dimensions.x / 2,
        y: dimensions.y,
        z: dimensions.z / 2,
      },
      rotation: zero,
    },
  ];
}

export function simulateCadFromText(
  prompt: string,
  quoteDimensions: QuoteDimensions,
): ValidatedCadLayoutPayload {
  const tradeCategories = detectTradeCategories(prompt);
  const dimensions = resolveDimensions(prompt, quoteDimensions);
  const structuralComponents = tradeCategories.flatMap((tradeCategory) =>
    buildComponents(tradeCategory, dimensions),
  );

  const result = CadLayoutPayloadSchema.safeParse({
    version: 1,
    units: "metres",
    coordinateSystem: "right-handed-y-up",
    rotationUnit: "radians",
    tradeCategory: tradeCategories[0],
    dimensions,
    origin: { x: 0, y: 0, z: 0 },
    structuralComponents,
  });

  if (!result.success) {
    throw new CadGenerationError(
      "The prompt could not be converted into a valid 3D layout",
    );
  }

  return result.data;
}
