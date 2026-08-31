import { getListQuotesQueryKey, useListQuotes } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/format";
import { FileText, Plus, Search } from "lucide-react";
import { useUser } from "@clerk/react";
import { useProfileAccess, visibleToProfile } from "@/lib/access";

export default function Quotes() {
  const { user } = useUser();
  const access = useProfileAccess();
  const { data: quotes, isLoading } = useListQuotes({
    query: { queryKey: getListQuotesQueryKey() },
  });
  const visibleQuotes = visibleToProfile(quotes, {
    ...access,
    identity: { userId: user?.id, email: user?.primaryEmailAddress?.emailAddress },
  });

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tight">Quotes</h1>
          <p className="text-muted-foreground font-medium">All your drafted and sent jobs.</p>
        </div>
        {!access.isSubcontractor && <Link href="/calculator">
          <Button className="font-bold uppercase">
            <Plus className="w-4 h-4 mr-2" /> New Quote
          </Button>
        </Link>}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => <div key={i} className="h-24 bg-muted animate-pulse rounded-md" />)}
        </div>
      ) : visibleQuotes.length === 0 ? (
        <div className="text-center py-20 border-2 border-dashed rounded-lg">
          <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-xl font-bold uppercase mb-2">No Quotes Yet</h2>
          <p className="text-muted-foreground mb-6">Quote up a job to get started.</p>
          {!access.isSubcontractor && <Link href="/calculator">
            <Button className="font-bold uppercase"><Plus className="w-4 h-4 mr-2"/> Start Estimating</Button>
          </Link>}
        </div>
      ) : (
        <div className="grid gap-3">
          {visibleQuotes.map((quote) => (
            <Link key={quote.id} href={`/quotes/${quote.id}`}>
              <Card className="hover:border-primary/50 transition-colors cursor-pointer group shadow-sm border-2">
                <CardContent className="p-4 md:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-black group-hover:text-primary transition-colors">{quote.title}</h3>
                    <div className="text-muted-foreground text-sm font-medium mt-1">
                      {quote.customerName} • {quote.lengthM}m × {quote.widthM}m
                    </div>
                  </div>
                  <div className="flex items-center justify-between md:flex-col md:items-end gap-2">
                    <div className="text-xl font-black font-mono">{formatCurrency(quote.total)}</div>
                    <span className={`text-xs font-bold uppercase px-3 py-1 rounded-sm
                      ${quote.status === 'accepted' ? 'bg-emerald-500/15 text-emerald-600' : 
                        quote.status === 'sent' ? 'bg-blue-500/15 text-blue-600' :
                        quote.status === 'rejected' ? 'bg-destructive/15 text-destructive' :
                        'bg-muted text-muted-foreground'}
                    `}>
                      {quote.status}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
