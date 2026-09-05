import assert from "node:assert/strict";
import test from "node:test";
import type { CadLayoutPayload } from "@workspace/api-client-react";
import { validateCadLayoutCompliance } from "./cad-compliance.ts";

const baseComponent = {
  material: "Test material",
  materialSku: null,
  geometryId: "geometry",
  rotation: { x: 0, y: 0, z: 0 },
};

test("flags electrical and plumbing components inside the clearance", () => {
  const layout: CadLayoutPayload = {
    version: 1,
    units: "metres",
    coordinateSystem: "right-handed-y-up",
    rotationUnit: "radians",
    tradeCategory: "electrical",
    dimensions: { x: 4, y: 3, z: 4 },
    origin: { x: 0, y: 0, z: 0 },
    structuralComponents: [
      {
        ...baseComponent,
        id: "outlet",
        name: "Power outlet",
        type: "outlet",
        tradeCategory: "electrical",
        dimensions: { x: 0.1, y: 0.1, z: 0.05 },
        position: { x: 1, y: 1, z: 1 },
      },
      {
        ...baseComponent,
        id: "pipe",
        name: "Water pipe",
        type: "pipe",
        tradeCategory: "plumbing",
        dimensions: { x: 0.05, y: 1, z: 0.05 },
        position: { x: 1.3, y: 1, z: 1 },
      },
    ],
  };

  const result = validateCadLayoutCompliance(layout);
  assert.equal(result.issues.length, 1);
  assert.deepEqual([...result.warningComponentIds].sort(), ["outlet", "pipe"]);
});

test("flags a long timber member without two nearby supports", () => {
  const layout: CadLayoutPayload = {
    version: 1,
    units: "metres",
    coordinateSystem: "right-handed-y-up",
    rotationUnit: "radians",
    tradeCategory: "carpentry",
    dimensions: { x: 4, y: 3, z: 4 },
    origin: { x: 0, y: 0, z: 0 },
    structuralComponents: [
      {
        ...baseComponent,
        id: "beam",
        name: "Bearer",
        type: "beam",
        tradeCategory: "carpentry",
        dimensions: { x: 3, y: 0.2, z: 0.1 },
        position: { x: 2, y: 1, z: 2 },
      },
    ],
  };

  const result = validateCadLayoutCompliance(layout);
  assert.equal(result.issues[0]?.ruleId, "AS1684-TIMBER-SPAN-SUPPORT");
  assert(result.warningComponentIds.has("beam"));
});

test("uses rotated component bounds for separation checks", () => {
  const layout: CadLayoutPayload = {
    version: 1,
    units: "metres",
    coordinateSystem: "right-handed-y-up",
    rotationUnit: "radians",
    tradeCategory: "electrical",
    dimensions: { x: 4, y: 3, z: 4 },
    origin: { x: 0, y: 0, z: 0 },
    structuralComponents: [
      {
        ...baseComponent,
        id: "rotated-outlet",
        name: "Rotated outlet",
        type: "outlet",
        tradeCategory: "electrical",
        dimensions: { x: 1, y: 0.1, z: 0.1 },
        position: { x: 1, y: 1, z: 1 },
        rotation: { x: 0, y: Math.PI / 2, z: 0 },
      },
      {
        ...baseComponent,
        id: "nearby-pipe",
        name: "Nearby water pipe",
        type: "pipe",
        tradeCategory: "plumbing",
        dimensions: { x: 0.05, y: 0.1, z: 0.05 },
        position: { x: 1, y: 1, z: 1.8 },
      },
    ],
  };

  assert.equal(validateCadLayoutCompliance(layout).issues.length, 1);
});
