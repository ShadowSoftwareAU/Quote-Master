import type {
  CadLayoutPayload,
  CadStructuralComponent,
} from "@workspace/api-client-react";

export type CadComplianceSeverity = "warning" | "error";

export interface CadComplianceIssue {
  id: string;
  ruleId: "ASNZS3000-WATER-SEPARATION" | "AS1684-TIMBER-SPAN-SUPPORT";
  standard: "AS/NZS 3000" | "AS 1684";
  severity: CadComplianceSeverity;
  message: string;
  componentIds: string[];
}

export interface CadComplianceResult {
  issues: CadComplianceIssue[];
  warningComponentIds: Set<string>;
}

const ELECTRICAL_WATER_CLEARANCE_M = 0.6;
const UNSUPPORTED_TIMBER_SPAN_M = 2.4;
const SUPPORT_HORIZONTAL_TOLERANCE_M = 0.35;
const SUPPORT_VERTICAL_TOLERANCE_M = 0.2;

function axisGap(
  firstPosition: number,
  firstSize: number,
  secondPosition: number,
  secondSize: number,
) {
  return Math.max(
    0,
    Math.abs(firstPosition - secondPosition) - (firstSize + secondSize) / 2,
  );
}

function rotatedDimensions(component: CadStructuralComponent) {
  const { x, y, z } = component.rotation;
  const sinX = Math.sin(x);
  const cosX = Math.cos(x);
  const sinY = Math.sin(y);
  const cosY = Math.cos(y);
  const sinZ = Math.sin(z);
  const cosZ = Math.cos(z);
  const { dimensions } = component;

  const matrix = [
    [cosY * cosZ, -cosY * sinZ, sinY],
    [
      cosX * sinZ + sinX * cosZ * sinY,
      cosX * cosZ - sinX * sinZ * sinY,
      -sinX * cosY,
    ],
    [
      sinX * sinZ - cosX * cosZ * sinY,
      sinX * cosZ + cosX * sinZ * sinY,
      cosX * cosY,
    ],
  ];

  return {
    x:
      Math.abs(matrix[0][0]) * dimensions.x +
      Math.abs(matrix[0][1]) * dimensions.y +
      Math.abs(matrix[0][2]) * dimensions.z,
    y:
      Math.abs(matrix[1][0]) * dimensions.x +
      Math.abs(matrix[1][1]) * dimensions.y +
      Math.abs(matrix[1][2]) * dimensions.z,
    z:
      Math.abs(matrix[2][0]) * dimensions.x +
      Math.abs(matrix[2][1]) * dimensions.y +
      Math.abs(matrix[2][2]) * dimensions.z,
  };
}

function componentClearance(
  first: CadStructuralComponent,
  second: CadStructuralComponent,
) {
  const firstBounds = rotatedDimensions(first);
  const secondBounds = rotatedDimensions(second);

  return Math.hypot(
    axisGap(first.position.x, firstBounds.x, second.position.x, secondBounds.x),
    axisGap(first.position.y, firstBounds.y, second.position.y, secondBounds.y),
    axisGap(first.position.z, firstBounds.z, second.position.z, secondBounds.z),
  );
}

function isElectricalPoint(component: CadStructuralComponent) {
  return (
    component.tradeCategory === "electrical" &&
    ["outlet", "junction-box", "fixture"].includes(component.type)
  );
}

function isWaterComponent(component: CadStructuralComponent) {
  return (
    component.tradeCategory === "plumbing" &&
    ["pipe", "fitting", "fixture"].includes(component.type)
  );
}

function isTimberSpan(component: CadStructuralComponent) {
  const bounds = rotatedDimensions(component);
  return (
    component.tradeCategory === "carpentry" &&
    ["beam", "joist"].includes(component.type) &&
    Math.max(bounds.x, bounds.z) > UNSUPPORTED_TIMBER_SPAN_M
  );
}

function supportIsUnderSpan(
  span: CadStructuralComponent,
  support: CadStructuralComponent,
) {
  const spanBounds = rotatedDimensions(span);
  const supportBounds = rotatedDimensions(support);
  const supportTop = support.position.y + supportBounds.y / 2;
  const spanBottom = span.position.y - spanBounds.y / 2;

  if (
    support.tradeCategory !== "carpentry" ||
    support.type !== "post" ||
    Math.abs(supportTop - spanBottom) > SUPPORT_VERTICAL_TOLERANCE_M
  ) {
    return false;
  }

  const alongX = spanBounds.x >= spanBounds.z;
  const crossAxisGap = alongX
    ? Math.abs(support.position.z - span.position.z)
    : Math.abs(support.position.x - span.position.x);
  const spanHalfLength = (alongX ? spanBounds.x : spanBounds.z) / 2;
  const supportAlongPosition = alongX ? support.position.x : support.position.z;
  const spanAlongPosition = alongX ? span.position.x : span.position.z;

  return (
    crossAxisGap <= SUPPORT_HORIZONTAL_TOLERANCE_M &&
    Math.abs(supportAlongPosition - spanAlongPosition) <=
      spanHalfLength + SUPPORT_HORIZONTAL_TOLERANCE_M
  );
}

export function validateCadLayoutCompliance(
  layout: CadLayoutPayload,
): CadComplianceResult {
  const issues: CadComplianceIssue[] = [];
  const electricalPoints =
    layout.structuralComponents.filter(isElectricalPoint);
  const waterComponents = layout.structuralComponents.filter(isWaterComponent);

  for (const electrical of electricalPoints) {
    for (const water of waterComponents) {
      const clearance = componentClearance(electrical, water);
      if (clearance >= ELECTRICAL_WATER_CLEARANCE_M) continue;

      issues.push({
        id: `water-separation:${electrical.id}:${water.id}`,
        ruleId: "ASNZS3000-WATER-SEPARATION",
        standard: "AS/NZS 3000",
        severity: "error",
        message: `${electrical.name} is ${clearance.toFixed(2)}m from ${water.name}. Maintain at least ${ELECTRICAL_WATER_CLEARANCE_M.toFixed(2)}m separation pending site verification.`,
        componentIds: [electrical.id, water.id],
      });
    }
  }

  for (const span of layout.structuralComponents.filter(isTimberSpan)) {
    const supports = layout.structuralComponents.filter((component) =>
      supportIsUnderSpan(span, component),
    );
    if (supports.length >= 2) continue;

    issues.push({
      id: `timber-support:${span.id}`,
      ruleId: "AS1684-TIMBER-SPAN-SUPPORT",
      standard: "AS 1684",
      severity: "warning",
      message: `${span.name} spans more than ${UNSUPPORTED_TIMBER_SPAN_M.toFixed(1)}m but has only ${supports.length} nearby support${supports.length === 1 ? "" : "s"}. Confirm member sizing and support spacing.`,
      componentIds: [span.id],
    });
  }

  return {
    issues,
    warningComponentIds: new Set(issues.flatMap((issue) => issue.componentIds)),
  };
}
