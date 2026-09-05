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
      "decking-board",
      "handrail",
      "conduit",
      "cable",
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
    structuralComponents: z
      .array(CadStructuralComponentSchema)
      .min(1)
      .max(500),
  })
  .strict();

export type ValidatedCadLayoutPayload = z.infer<
  typeof CadLayoutPayloadSchema
>;