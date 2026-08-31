import { useParams } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetMasterProjectPortalQueryKey,
  useGetMasterProjectPortal,
  useSetMasterProjectPortalStatus,
} from "@workspace/api-client-react";
import { Check, CheckCircle2, HardHat, Info, Layers3 } from "lucide-react";
import { formatCurrency } from "@/lib/format";

export default function MasterProjectPortalPage() {
  const { token = "" } = useParams();
  const queryClient = useQueryClient();
  const { data: project, isLoading, isError } = useGetMasterProjectPortal(token, {
    query: {
      enabled: Boolean(token),
      queryKey: getGetMasterProjectPortalQueryKey(token),
    },
  });
  const setStatus = useSetMasterProjectPortalStatus();

  if (isLoading) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-background p-6">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="mt-6 text-muted-foreground font-medium">Preparing your proposal...</p>
      </div>
    );
  }

  if (isError || !project) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background p-6">
        <div className="bg-white p-8 rounded-xl shadow-sm border max-w-md w-full text-center">
          <div className="w-16 h-16 bg-destructive/10 text-destructive flex items-center justify-center rounded-full mx-auto mb-6">
            <Info className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-display font-bold">Proposal Unavailable</h1>
          <p className="text-muted-foreground mt-2">
            This secure link may have expired or been revoked. Please contact your builder
            for a new link.
          </p>
        </div>
      </div>
    );
  }

  const accepted = project.status === "accepted";
  return (
    <div className="min-h-[100dvh] bg-background">
      <header className="bg-secondary text-secondary-foreground py-6 px-6 md:px-12 shadow-md">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={`${import.meta.env.BASE_URL}quote-master-logo.jpg`} alt="Quote Master" className="w-48 h-auto object-contain" />
          </div>
          {accepted && (
            <div className="flex items-center gap-2 bg-green-500/20 text-green-300 px-4 py-1.5 rounded-full font-medium text-sm border border-green-500/30">
              <CheckCircle2 className="w-4 h-4" /> Accepted
            </div>
          )}
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-6 md:px-12 py-12 grid lg:grid-cols-12 gap-10">
        <div className="lg:col-span-8 space-y-8">
          <section>
            <p className="font-bold uppercase tracking-widest text-primary text-sm">
              Master Project Proposal
            </p>
            <h1 className="text-4xl md:text-5xl font-display font-black mt-2">
              {project.title}
            </h1>
            <p className="text-lg text-muted-foreground mt-3">
              Review the combined scope and pricing below, grouped by trade.
            </p>
            {project.notes && (
              <p className="mt-5 whitespace-pre-wrap text-foreground">{project.notes}</p>
            )}
          </section>

          {project.tradeGroups.map((group) => (
            <section key={group.tradeType} className="bg-white rounded-2xl border shadow-sm overflow-hidden">
              <div className="bg-secondary text-secondary-foreground px-6 py-4 flex items-center gap-3">
                <Layers3 className="w-5 h-5 text-primary" />
                <h2 className="font-display font-black text-xl uppercase">{group.label}</h2>
              </div>
              <div className="divide-y">
                {group.quotes.map((quote) => (
                  <article key={quote.id} className="p-6 space-y-4">
                    <div className="flex justify-between gap-4">
                      <div>
                        <h3 className="font-display font-bold text-xl">{quote.title}</h3>
                        <p className="text-xs uppercase font-bold text-muted-foreground mt-1">
                          {quote.status}
                        </p>
                      </div>
                      <strong className="font-mono text-lg">{formatCurrency(quote.total)}</strong>
                    </div>
                    <div className="space-y-2">
                      {quote.lineItems.map((line, lineIndex) => (
                        <div key={`${line.description}-${lineIndex}`} className="flex justify-between gap-4 text-sm">
                          <span className="text-muted-foreground">
                            {line.description} · {line.quantity} {line.unit}
                          </span>
                          <span className="font-mono">{formatCurrency(line.lineTotal)}</span>
                        </div>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))}

          <section className="rounded-2xl border border-primary/20 bg-primary/5 p-6 md:p-8">
            <h2 className="text-lg font-display font-bold">Australian Building Compliance</h2>
            <p className="text-sm leading-relaxed text-muted-foreground mt-3">
              {project.complianceDisclaimer}
            </p>
          </section>
        </div>

        <aside className="lg:col-span-4">
          <div className="lg:sticky lg:top-8 bg-secondary text-secondary-foreground rounded-2xl shadow-xl overflow-hidden">
            <div className="p-6 space-y-3">
              <h2 className="font-display font-bold text-2xl">Investment Summary</h2>
              <div className="flex justify-between text-secondary-foreground/70">
                <span>Materials</span>
                <span>{formatCurrency(project.materialsSubtotal)}</span>
              </div>
              <div className="flex justify-between text-secondary-foreground/70">
                <span>Labour</span>
                <span>{formatCurrency(project.labourSubtotal)}</span>
              </div>
              {project.marginAmount > 0 && (
                <div className="flex justify-between text-secondary-foreground/70">
                  <span>Builder margin</span>
                  <span>{formatCurrency(project.marginAmount)}</span>
                </div>
              )}
              <div className="flex justify-between text-secondary-foreground/70">
                <span>GST (10%)</span>
                <span>{formatCurrency(project.gst)}</span>
              </div>
              <div className="border-t border-secondary-foreground/10 pt-5 mt-5">
                <span className="text-sm text-secondary-foreground/70">Total inc. GST</span>
                <p className="font-display font-black text-4xl text-white mt-1">
                  {formatCurrency(project.total)}
                </p>
              </div>
            </div>
            <div className="p-6 bg-secondary-foreground/5">
              {accepted ? (
                <div className="w-full bg-green-500/20 text-green-300 font-bold py-4 rounded-xl flex justify-center items-center gap-2 border border-green-500/30">
                  <Check className="w-5 h-5" /> Proposal Accepted
                </div>
              ) : (
                <button
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-lg py-4 rounded-xl disabled:opacity-50"
                  disabled={setStatus.isPending}
                  onClick={() =>
                    setStatus.mutate(
                      { token, data: { status: "accepted" } },
                      {
                        onSuccess: () =>
                          queryClient.invalidateQueries({
                            queryKey: getGetMasterProjectPortalQueryKey(token),
                          }),
                      },
                    )
                  }
                >
                  {setStatus.isPending ? "Accepting..." : "Accept Master Proposal"}
                </button>
              )}
              {!accepted && (
                <p className="text-center text-xs text-secondary-foreground/50 mt-4">
                  By accepting, you agree to the combined scope and pricing shown.
                </p>
              )}
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
}
