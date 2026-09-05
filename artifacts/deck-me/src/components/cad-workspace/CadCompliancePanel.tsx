import type { CadComplianceResult } from "@/lib/cad-compliance";
import { AlertTriangle, CheckCircle, ScrollText } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

export function CadCompliancePanel({
  complianceResult,
}: {
  complianceResult: CadComplianceResult;
}) {
  const hasIssues = complianceResult.issues.length > 0;

  const errorCount = complianceResult.issues.filter(
    (i) => i.severity === "error",
  ).length;
  const warningCount = complianceResult.issues.filter(
    (i) => i.severity === "warning",
  ).length;

  return (
    <div className="flex flex-col h-full bg-card">
      <div className="p-4 border-b bg-muted/10 shrink-0">
        <h3 className="font-display font-black uppercase text-sm flex items-center gap-2">
          <ScrollText className="w-4 h-4 text-primary" />
          Compliance Checks
        </h3>

        <div className="mt-3 flex gap-2">
          {!hasIssues ? (
            <Badge
              variant="outline"
              className="bg-emerald-500/10 text-emerald-700 border-emerald-500/20 font-bold uppercase rounded-sm"
            >
              <CheckCircle className="w-3 h-3 mr-1" /> All clear
            </Badge>
          ) : (
            <>
              {errorCount > 0 && (
                <Badge
                  variant="destructive"
                  className="font-bold uppercase rounded-sm"
                >
                  {errorCount} {errorCount === 1 ? "Error" : "Errors"}
                </Badge>
              )}
              {warningCount > 0 && (
                <Badge
                  variant="outline"
                  className="bg-amber-500/10 text-amber-700 border-amber-500/20 font-bold uppercase rounded-sm"
                >
                  {warningCount} {warningCount === 1 ? "Warning" : "Warnings"}
                </Badge>
              )}
            </>
          )}
        </div>
      </div>

      <ScrollArea className="flex-1 p-4" data-testid="cad-compliance-list">
        {!hasIssues ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground py-8 opacity-70">
            <CheckCircle className="w-8 h-8 mb-2 text-emerald-500" />
            <p className="text-sm font-medium">
              No automated compliance issues detected.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {complianceResult.issues.map((issue) => (
              <div
                key={issue.id}
                className={`p-3 border-l-2 rounded-r-md bg-muted/30 ${
                  issue.severity === "error"
                    ? "border-destructive"
                    : "border-amber-500"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <AlertTriangle
                    className={`w-4 h-4 ${issue.severity === "error" ? "text-destructive" : "text-amber-500"}`}
                  />
                  <span className="text-xs font-bold uppercase tracking-tight text-foreground">
                    {issue.standard}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground leading-snug">
                  {issue.message}
                </p>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      <div className="p-3 border-t bg-muted/20 shrink-0 text-[10px] text-muted-foreground font-medium uppercase tracking-wider text-center">
        Automated preliminary checks only.
        <br />
        Not a substitute for certification.
      </div>
    </div>
  );
}
