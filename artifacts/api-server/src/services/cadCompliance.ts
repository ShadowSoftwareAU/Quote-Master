import {
  CadComplianceEvaluationSchema,
  type ValidatedCadComplianceEvaluation,
  type ValidatedCadLayoutPayload,
} from "@workspace/api-zod";

const EVALUATED_STANDARDS = [
  "NCC 2022",
  "AS 1684",
  "AS/NZS 3000",
  "AS/NZS 3500",
] as const;

type Finding = ValidatedCadComplianceEvaluation["findings"][number];

function finding(
  value: Omit<Finding, "componentIds"> & { componentIds?: string[] },
): Finding {
  return { ...value, componentIds: value.componentIds ?? [] };
}

/**
 * Runs the fixed, conservative CAD v1 preflight rules. This is deterministic
 * and intentionally does not claim to replace engineering or certification.
 */
export function evaluateCadLayoutCompliance(
  layout: ValidatedCadLayoutPayload,
): ValidatedCadComplianceEvaluation {
  const findings: Finding[] = [];
  const components = layout.structuralComponents;
  const hasCarpentry = components.some(
    ({ tradeCategory }) => tradeCategory === "carpentry",
  );
  const hasElectrical = components.some(
    ({ tradeCategory }) => tradeCategory === "electrical",
  );
  const hasPlumbing = components.some(
    ({ tradeCategory }) => tradeCategory === "plumbing",
  );

  if (
    hasCarpentry &&
    layout.dimensions.y >= 1 &&
    !components.some(
      (component) =>
        component.tradeCategory === "carpentry" &&
        component.type === "handrail",
    )
  ) {
    findings.push(
      finding({
        code: "NCC-2022-FALL-PROTECTION",
        standard: "NCC 2022",
        severity: "block",
        title: "Fall protection is not represented",
        message:
          "A carpentry layout at least 1 metre high must represent a handrail or barrier for review.",
      }),
    );
  }

  if (hasCarpentry) {
    const framing = components.filter(
      (component) =>
        component.tradeCategory === "carpentry" &&
        (component.type === "beam" || component.type === "joist"),
    );
    if (
      !framing.some((component) => component.type === "beam") ||
      !framing.some((component) => component.type === "joist")
    ) {
      findings.push(
        finding({
          code: "AS1684-FRAMING-INCOMPLETE",
          standard: "AS 1684",
          severity: "block",
          title: "Timber framing is incomplete",
          message:
            "The layout must include both bearer/beam and joist framing members.",
          componentIds: framing.map((component) => component.id),
        }),
      );
    }

    const longMembers = framing.filter(
      (component) =>
        Math.max(component.dimensions.x, component.dimensions.z) > 4.8,
    );
    if (longMembers.length > 0) {
      findings.push(
        finding({
          code: "AS1684-SPAN-REVIEW",
          standard: "AS 1684",
          severity: "warning",
          title: "Timber member span requires review",
          message:
            "A represented framing member exceeds the 4.8 metre CAD v1 preflight threshold; verify species, grade, loads and supports.",
          componentIds: longMembers.map((component) => component.id),
        }),
      );
    }
  }

  if (hasElectrical) {
    const wiring = components.filter(
      (component) =>
        component.tradeCategory === "electrical" &&
        (component.type === "conduit" || component.type === "cable"),
    );
    const accessories = components.filter(
      (component) =>
        component.tradeCategory === "electrical" &&
        (component.type === "junction-box" || component.type === "outlet"),
    );
    if (wiring.length === 0 || accessories.length === 0) {
      findings.push(
        finding({
          code: "ASNZS3000-CONTAINMENT-INCOMPLETE",
          standard: "AS/NZS 3000",
          severity: "block",
          title: "Electrical containment is incomplete",
          message:
            "The layout must represent wiring or conduit and a connection accessory such as an outlet or junction box.",
          componentIds: [...wiring, ...accessories].map(
            (component) => component.id,
          ),
        }),
      );
    }

    const undersized = wiring.filter(
      (component) =>
        Math.min(component.dimensions.y, component.dimensions.z) < 0.02,
    );
    if (undersized.length > 0) {
      findings.push(
        finding({
          code: "ASNZS3000-CONTAINMENT-SIZE-REVIEW",
          standard: "AS/NZS 3000",
          severity: "warning",
          title: "Electrical containment size requires review",
          message:
            "A represented cable or conduit is below the 20 mm CAD v1 preflight threshold; verify fill, protection and installation conditions.",
          componentIds: undersized.map((component) => component.id),
        }),
      );
    }
  }

  if (hasPlumbing) {
    const pipes = components.filter(
      (component) =>
        component.tradeCategory === "plumbing" && component.type === "pipe",
    );
    if (
      pipes.length === 0 ||
      !components.some(
        (component) =>
          component.tradeCategory === "plumbing" &&
          component.type === "fitting",
      )
    ) {
      findings.push(
        finding({
          code: "ASNZS3500-SYSTEM-INCOMPLETE",
          standard: "AS/NZS 3500",
          severity: "block",
          title: "Plumbing system is incomplete",
          message: "The layout must represent both pipework and a fitting.",
          componentIds: pipes.map((component) => component.id),
        }),
      );
    }

    const undersized = pipes.filter(
      (component) =>
        Math.min(component.dimensions.y, component.dimensions.z) < 0.015,
    );
    if (undersized.length > 0) {
      findings.push(
        finding({
          code: "ASNZS3500-PIPE-SIZE-REVIEW",
          standard: "AS/NZS 3500",
          severity: "warning",
          title: "Pipe size requires review",
          message:
            "A represented pipe is below the 15 mm CAD v1 preflight threshold; verify demand, pressure and installation conditions.",
          componentIds: undersized.map((component) => component.id),
        }),
      );
    }
  }

  const status = findings.some(({ severity }) => severity === "block")
    ? "block"
    : findings.length > 0
      ? "warning"
      : "pass";

  return CadComplianceEvaluationSchema.parse({
    version: 1,
    status,
    evaluatedStandards: EVALUATED_STANDARDS,
    findings,
  });
}