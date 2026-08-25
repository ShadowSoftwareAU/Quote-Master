import type { DeckSpec } from "./estimator";

export type ComplianceWarningCode =
  | "JOIST_CENTRES_EXCEEDED"
  | "JOIST_SPAN_EXCEEDED"
  | "BEARER_SPAN_EXCEEDED"
  | "FOOTING_DEPTH_INSUFFICIENT";

export interface ComplianceWarning {
  code: ComplianceWarningCode;
  severity: "warning";
  standard: "AS 1684 screening check";
  title: string;
  message: string;
  actual: number;
  limit: number;
  recommendation: string;
}

/**
 * Conservative framing limits used for early design screening only.
 * Final member selection must still be confirmed against the current AS 1684
 * tables, site loads, timber grade, wind classification, soil conditions,
 * NCC requirements, and any local approval conditions.
 */
export const FRAMING_RULES = {
  joist: {
    assumedMember: "90×45mm treated pine joist",
    maxCentresMm: 450,
    maxSpanM: 1.8,
  },
  bearer: {
    assumedMember: "140×45mm treated pine bearer",
    maxSpanM: 2.4,
  },
  footing: {
    assumedPost: "90×90mm treated pine post",
    minDepthMm: 450,
  },
} as const;

export function validateDeckCompliance(
  spec: Pick<
    DeckSpec,
    "joistSpacingMm" | "bearerSpacingMm" | "postSpacingMm" | "subframeType" | "footingDepthMm"
  >,
): ComplianceWarning[] {
  const warnings: ComplianceWarning[] = [];

  if (spec.joistSpacingMm > FRAMING_RULES.joist.maxCentresMm) {
    warnings.push({
      code: "JOIST_CENTRES_EXCEEDED",
      severity: "warning",
      standard: "AS 1684 screening check",
      title: "Joist centres exceed the screening limit",
      message: `${FRAMING_RULES.joist.assumedMember} is set at ${spec.joistSpacingMm}mm centres. This screening rule uses a maximum of ${FRAMING_RULES.joist.maxCentresMm}mm centres.`,
      actual: spec.joistSpacingMm,
      limit: FRAMING_RULES.joist.maxCentresMm,
      recommendation: "Reduce joist centres or confirm a larger member against the current AS 1684 span tables.",
    });
  }

  const joistSpanM = spec.bearerSpacingMm / 1000;
  if (joistSpanM > FRAMING_RULES.joist.maxSpanM) {
    warnings.push({
      code: "JOIST_SPAN_EXCEEDED",
      severity: "warning",
      standard: "AS 1684 screening check",
      title: "Joist span exceeds the screening limit",
      message: `${FRAMING_RULES.joist.assumedMember} spans ${joistSpanM.toFixed(2)}m between bearers. This screening rule uses a maximum span of ${FRAMING_RULES.joist.maxSpanM.toFixed(2)}m.`,
      actual: joistSpanM,
      limit: FRAMING_RULES.joist.maxSpanM,
      recommendation: "Upgrade the joist size or add a mid-span bearer support.",
    });
  }

  const bearerSpanM = spec.postSpacingMm / 1000;
  if (spec.subframeType === "stumps" && bearerSpanM > FRAMING_RULES.bearer.maxSpanM) {
    warnings.push({
      code: "BEARER_SPAN_EXCEEDED",
      severity: "warning",
      standard: "AS 1684 screening check",
      title: "Bearer span exceeds the screening limit",
      message: `${FRAMING_RULES.bearer.assumedMember} spans ${bearerSpanM.toFixed(2)}m between posts. This screening rule uses a maximum span of ${FRAMING_RULES.bearer.maxSpanM.toFixed(2)}m.`,
      actual: bearerSpanM,
      limit: FRAMING_RULES.bearer.maxSpanM,
      recommendation: "Upgrade the bearer size or add a post or support below the bearer.",
    });
  }

  if (spec.subframeType === "stumps" && spec.footingDepthMm < FRAMING_RULES.footing.minDepthMm) {
    warnings.push({
      code: "FOOTING_DEPTH_INSUFFICIENT",
      severity: "warning",
      standard: "AS 1684 screening check",
      title: "Footing depth is below the screening minimum",
      message: `${FRAMING_RULES.footing.assumedPost} footing depth is ${spec.footingDepthMm}mm. This screening rule uses a minimum depth of ${FRAMING_RULES.footing.minDepthMm}mm.`,
      actual: spec.footingDepthMm,
      limit: FRAMING_RULES.footing.minDepthMm,
      recommendation: "Increase footing depth and confirm the footing design against the site soil classification and local requirements.",
    });
  }

  return warnings;
}