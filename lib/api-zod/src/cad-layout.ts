import { z } from "zod";

export const CadTradeCategorySchema = z.enum([
  "carpentry",
  "electrical",
  "plumbing",
]);

export const CadVector3Schema = z
  .object({
    x: z.number().finite(),
    y: z.number().finite(),
    z: z.number().finite(),
  })
  .strict();

export const CadDimensionsSchema = CadVector3Schema.refine(
  ({ x, y, z }) => x > 0 && y > 0 && z > 0,
  "CAD dimensions must be greater than zero",
);

export const CadStructuralComponentSchema = z
  .object({
    id: z.string().min(1).max(100),
    name: z.string().min(1).max(200),
    type: z.enum([
      "beam",
      "post",
      "joist",
      "wall",
      "decking-board",
      "handrail",
      "conduit",
      "cable",
      "outlet",
      "junction-box",
      "pipe",
      "fitting",
      "fixture",
    ]),
    tradeCategory: CadTradeCategorySchema,
    material: z.string().min(1).max(200),
    materialSku: z.string().min(1).max(100).nullable(),
    geometryId: z.string().min(1).max(100),
    dimensions: CadDimensionsSchema,
    position: CadVector3Schema,
    rotation: CadVector3Schema,
  })
  .strict();

export const CadLayoutPayloadSchema = z
  .object({
    version: z.literal(1),
    units: z.literal("metres"),
    coordinateSystem: z.literal("right-handed-y-up"),
    rotationUnit: z.literal("radians"),
    tradeCategory: CadTradeCategorySchema,
    dimensions: CadDimensionsSchema,
    origin: CadVector3Schema,
    structuralComponents: z.array(CadStructuralComponentSchema).min(1).max(500),
  })
  .strict();

export const CadComplianceStandardSchema = z.enum([
  "NCC 2022",
  "AS 1684",
  "AS/NZS 3000",
  "AS/NZS 3500",
]);
export const CadComplianceSeveritySchema = z.enum(["warning", "block"]);

export const CadComplianceFindingSchema = z
  .object({
    code: z.string().min(1).max(100),
    standard: CadComplianceStandardSchema,
    severity: CadComplianceSeveritySchema,
    title: z.string().min(1).max(200),
    message: z.string().min(1).max(1000),
    componentIds: z.array(z.string().min(1).max(100)),
  })
  .strict();

export const CadComplianceEvaluationSchema = z
  .object({
    version: z.literal(1),
    status: z.enum(["pass", "warning", "block"]),
    evaluatedStandards: z.array(CadComplianceStandardSchema).length(4),
    findings: z.array(CadComplianceFindingSchema).max(100),
  })
  .strict();

export type ValidatedCadLayoutPayload = z.infer<typeof CadLayoutPayloadSchema>;

export type ValidatedCadComplianceEvaluation = z.infer<
  typeof CadComplianceEvaluationSchema
>;
