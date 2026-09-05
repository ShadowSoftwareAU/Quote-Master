import type { CadComplianceEvaluation } from "@workspace/api-client-react";
import type { CadComplianceResult } from "@/lib/cad-compliance";
import {
  AlertTriangle,
  CheckCircle,
  ScrollText,
  XCircle,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

interface DisplayFinding {
  id: string;
  standard: string;
  severity: "warning" | "block";
  title: string;
  message: string;
}

export function CadCompliancePanel({
  compliance,
  spatialCompliance,
}: {
  compliance: CadComplianceEvaluation;
  spatialCompliance: CadComplianceResult;
}) {
  const findings: DisplayFinding[] = [
    ...compliance.findings.map((finding) => ({
      id: `preflight:${finding.code}`,
      standard: finding.standard,
      severity: finding.severity,
      title: finding.title,
      message: finding.message,
    })),
    ...spatialCompliance.issues.map((issue) => ({
      id: `spatial:${issue.id}`,
      standard: issue.standard,
      severity: issue.severity === "error" ? ("block" as const) : ("warning" as const),
      title:
        issue.severity === "error"
          ? "Required separation is not represented"
          : "Structural support requires review",
      message: issue.message,
    })),
  ];
  const blockCount = findings.filter(
    ({ severity }) => severity === "block",
  ).length;
  const warningCount = findings.filter(
    ({ severity }) => severity === "warning",
  ).length;

  return (
    <div className="flex h-full flex-col bg-card">
      <div className="shrink-0 border-b bg-muted/10 p-4">
        <h3 className="flex items-center gap-2 font-display text-sm font-black uppercase">
          <ScrollText className="h-4 w-4 text-primary" />
          Compliance Preflight
        </h3>

        <div className="mt-3 flex flex-wrap gap-2">
          {blockCount > 0 ? (
            <Badge
              variant="destructive"
              className="rounded-sm font-bold uppercase"
              data-testid="status-cad-preflight"
            >
              <XCircle className="mr-1 h-3 w-3" />
              {blockCount} hard {blockCount === 1 ? "block" : "blocks"}
            </Badge>
          ) : warningCount > 0 ? (
            <Badge
              variant="outline"
              className="rounded-sm border-amber-500/20 bg-amber-500/10 font-bold uppercase text-amber-700"
              data-testid="status-cad-preflight"
            >
              <AlertTriangle className="mr-1 h-3 w-3" />
              Review warning
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="rounded-sm border-emerald-500/20 bg-emerald-500/10 font-bold uppercase text-emerald-700"
              data-testid="status-cad-preflight"
            >
              <CheckCircle className="mr-1 h-3 w-3" />
              Preflight clear
            </Badge>
          )}
          {blockCount > 0 && warningCount > 0 && (
            <Badge
              variant="outline"
              className="rounded-sm border-amber-500/20 bg-amber-500/10 font-bold uppercase text-amber-700"
            >
              {warningCount} {warningCount === 1 ? "warning" : "warnings"}
            </Badge>
          )}
        </div>

        <p
          className="mt-3 text-[10px] font-bold uppercase leading-relaxed tracking-wide text-muted-foreground"
          data-testid="text-cad-standards"
        >
          {compliance.evaluatedStandards.join(" · ")}
        </p>
      </div>

      <ScrollArea className="flex-1 p-4" data-testid="cad-compliance-list">
        {findings.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center py-8 text-center text-muted-foreground opacity-70">
            <CheckCircle className="mb-2 h-8 w-8 text-emerald-500" />
            <p className="text-sm font-medium">
              No warning or hard-block findings were produced.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {findings.map((finding) => (
              <div
                key={finding.id}
                className={`rounded-r-md border-l-2 bg-muted/30 p-3 ${
                  finding.severity === "block"
                    ? "border-destructive"
                    : "border-amber-500"
                }`}
                data-testid={`card-finding-${finding.id}`}
              >
                <div className="mb-1 flex items-center gap-2">
                  {finding.severity === "block" ? (
                    <XCircle className="h-4 w-4 text-destructive" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                  )}
                  <span
                    className={`text-[10px] font-black uppercase tracking-widest ${
                      finding.severity === "block"
                        ? "text-destructive"
                        : "text-amber-600"
                    }`}
                  >
                    {finding.severity === "block" ? "Hard block" : "Warning"}
                  </span>
                </div>
                <p className="text-sm font-bold leading-snug">{finding.title}</p>
                <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                  {finding.standard}
                </p>
                <p className="mt-1.5 text-xs leading-snug text-muted-foreground">
                  {finding.message}
                </p>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      <div
        className="shrink-0 border-t bg-muted/20 p-3 text-center text-[10px] font-medium uppercase tracking-wider text-muted-foreground"
        data-testid="text-cad-disclaimer"
      >
        Deterministic preflight guidance only.
        <br />
        Final compliance requires certified review.
      </div>
    </div>
  );
}