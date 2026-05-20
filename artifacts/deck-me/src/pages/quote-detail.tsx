import { useGetQuote, useSetQuoteStatus, useDeleteQuote, getGetQuoteQueryKey } from "@workspace/api-client-react";
import { useParams, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/format";
import { CheckCircle, XCircle, Send, Trash2, Edit2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreVertical } from "lucide-react";

export default function QuoteDetail() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const quoteId = parseInt(id || "0");
  const { data: quote, isLoading } = useGetQuote(quoteId, { query: { enabled: !!quoteId, queryKey: getGetQuoteQueryKey(quoteId) } });
  const setStatus = useSetQuoteStatus();
  const deleteQuote = useDeleteQuote();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  if (isLoading || !quote) return <div className="p-8"><Skeleton className="h-64" /></div>;

  const updateStatus = (status: string) => {
    setStatus.mutate(
      { id: quoteId, data: { status } },
      { onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetQuoteQueryKey(quoteId) });
        toast({ title: `Quote marked as ${status}` });
      }}
    );
  };

  const handleDelete = () => {
    if (confirm("Are you sure you want to delete this quote?")) {
      deleteQuote.mutate({ id: quoteId }, {
        onSuccess: () => {
          toast({ title: "Quote deleted" });
          setLocation("/quotes");
        }
      });
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tight">{quote.title}</h1>
          <p className="text-muted-foreground font-medium text-lg mt-1">{quote.customerName}</p>
        </div>
        <div className="flex gap-2 items-center">
          {quote.status === 'draft' && (
            <Button onClick={() => updateStatus('sent')} className="font-bold uppercase"><Send className="w-4 h-4 mr-2" /> Mark Sent</Button>
          )}
          {quote.status === 'sent' && (
            <>
              <Button onClick={() => updateStatus('accepted')} className="bg-emerald-600 hover:bg-emerald-700 font-bold uppercase"><CheckCircle className="w-4 h-4 mr-2"/> Accepted</Button>
              <Button onClick={() => updateStatus('rejected')} variant="destructive" className="font-bold uppercase"><XCircle className="w-4 h-4 mr-2"/> Rejected</Button>
            </>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon"><MoreVertical className="w-4 h-4" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleDelete} className="text-destructive">
                <Trash2 className="w-4 h-4 mr-2" /> Delete Quote
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <Card className="border-2 shadow-sm">
            <CardHeader className="bg-muted/30 border-b pb-4">
              <CardTitle className="font-display font-black uppercase">Bill of Materials</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {quote.lineItems?.map((item) => (
                  <div key={item.id} className="p-4 flex justify-between items-center text-sm hover:bg-muted/10">
                    <div>
                      <div className="font-bold text-foreground">{item.description}</div>
                      <div className="text-xs text-muted-foreground">{item.quantity} {item.unit} @ {formatCurrency(item.unitPrice)}</div>
                    </div>
                    <div className="font-mono font-bold text-base">{formatCurrency(item.lineTotal)}</div>
                  </div>
                ))}
                {(!quote.lineItems || quote.lineItems.length === 0) && (
                  <div className="p-8 text-center text-muted-foreground font-medium">No materials listed.</div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="border-2 border-primary/30 bg-primary/5 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold uppercase text-muted-foreground">Total Value</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-black text-foreground font-mono">{formatCurrency(quote.total)}</div>
              <div className="mt-4 space-y-2 text-sm font-medium text-muted-foreground">
                <div className="flex justify-between border-b pb-1"><span>Materials</span> <span className="font-mono text-foreground">{formatCurrency(quote.materialsSubtotal)}</span></div>
                <div className="flex justify-between border-b pb-1"><span>Labour</span> <span className="font-mono text-foreground">{formatCurrency(quote.labourCost)}</span></div>
                <div className="flex justify-between"><span>GST</span> <span className="font-mono text-foreground">{formatCurrency(quote.gst)}</span></div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-2 shadow-sm">
            <CardContent className="p-4 space-y-4 text-sm font-medium">
              <div>
                <span className="text-muted-foreground uppercase text-xs font-bold block mb-1">Dimensions</span>
                {quote.lengthM}m × {quote.widthM}m ({Math.round(quote.lengthM * quote.widthM * 100) / 100}m²)
              </div>
              <div>
                <span className="text-muted-foreground uppercase text-xs font-bold block mb-1">Labour</span>
                {quote.labourHours} hours @ {formatCurrency(quote.labourRate || 0)}/hr
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
