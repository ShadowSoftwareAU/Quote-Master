import { useGetQuote, useSetQuoteStatus, useDeleteQuote, useCreateQuoteVariation, getGetQuoteQueryKey, getListQuotesQueryKey } from "@workspace/api-client-react";
import { useParams, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency } from "@/lib/format";
import { CheckCircle, XCircle, Send, Trash2, Copy, AlertTriangle, Download } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreVertical } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useState } from "react";

const COUNCIL_HEIGHT_M = 1.0;

export default function QuoteDetail() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const quoteId = parseInt(id || "0");
  const { data: quote, isLoading } = useGetQuote(quoteId, { query: { enabled: !!quoteId, queryKey: getGetQuoteQueryKey(quoteId) } });
  const setStatus = useSetQuoteStatus();
  const deleteQuote = useDeleteQuote();
  const createVariation = useCreateQuoteVariation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [variationOpen, setVariationOpen] = useState(false);
  const [varTitle, setVarTitle] = useState("");
  const [varNotes, setVarNotes] = useState("");

  if (isLoading || !quote) return <div className="p-8"><Skeleton className="h-64" /></div>;

  const councilWarning = quote.heightM >= COUNCIL_HEIGHT_M;

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

  const handleCreateVariation = () => {
    if (!varTitle.trim()) {
      toast({ title: "Enter a title for the variation", variant: "destructive" });
      return;
    }
    createVariation.mutate(
      { id: quoteId, data: { title: varTitle, notes: varNotes || undefined } },
      {
        onSuccess: (data) => {
          queryClient.invalidateQueries({ queryKey: getListQuotesQueryKey() });
          toast({ title: "Variation quote created" });
          setVariationOpen(false);
          setLocation(`/quotes/${data.id}`);
        }
      }
    );
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {councilWarning && (
        <div className="flex items-start gap-3 bg-red-600 text-white rounded-lg px-5 py-4 border-2 border-red-700">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <div className="font-black uppercase text-sm">Council Certification May Be Required</div>
            <div className="text-sm text-red-100">
              Deck height {quote.heightM}m exceeds 1.0m — a building permit may be required.
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tight">{quote.title}</h1>
          <p className="text-muted-foreground font-medium text-lg mt-1">{quote.customerName}</p>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          {quote.status === 'draft' && (
            <Button onClick={() => updateStatus('sent')} className="font-bold uppercase"><Send className="w-4 h-4 mr-2" /> Mark Sent</Button>
          )}
          {quote.status === 'sent' && (
            <>
              <Button onClick={() => updateStatus('accepted')} className="bg-emerald-600 hover:bg-emerald-700 font-bold uppercase"><CheckCircle className="w-4 h-4 mr-2"/> Accepted</Button>
              <Button onClick={() => updateStatus('rejected')} variant="destructive" className="font-bold uppercase"><XCircle className="w-4 h-4 mr-2"/> Rejected</Button>
            </>
          )}
          {(quote.status === 'accepted' || quote.status === 'sent') && (
            <Button
              variant="outline"
              onClick={() => { setVarTitle(`${quote.title} — Variation`); setVarNotes(""); setVariationOpen(true); }}
              className="font-bold uppercase"
            >
              <Copy className="w-4 h-4 mr-2" /> Variation
            </Button>
          )}
          <Button
            variant="outline"
            className="font-bold uppercase"
            onClick={() => window.open(`/api/quotes/${quoteId}/pdf`, "_blank")}
          >
            <Download className="w-4 h-4 mr-2" /> PDF
          </Button>
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
                <span className="text-muted-foreground uppercase text-xs font-bold block mb-1">Height</span>
                {quote.heightM}m above ground
                {councilWarning && <span className="ml-2 text-red-600 text-xs font-bold">⚠ Permit req'd</span>}
              </div>
              <div>
                <span className="text-muted-foreground uppercase text-xs font-bold block mb-1">Labour</span>
                {quote.labourHours} hours @ {formatCurrency(quote.labourRate || 0)}/hr
              </div>
              {quote.notes && (
                <div>
                  <span className="text-muted-foreground uppercase text-xs font-bold block mb-1">Notes</span>
                  <p className="text-foreground">{quote.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={variationOpen} onOpenChange={setVariationOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display font-black uppercase text-xl">Create Variation</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">Create a new quote based on <strong>{quote.title}</strong> with different dimensions or labour.</p>
            <div className="space-y-2">
              <Label className="font-bold uppercase text-xs">Variation Title</Label>
              <Input value={varTitle} onChange={e => setVarTitle(e.target.value)} placeholder="E.g. Smith Deck — Extended" />
            </div>
            <div className="space-y-2">
              <Label className="font-bold uppercase text-xs">Notes (what's different)</Label>
              <Input value={varNotes} onChange={e => setVarNotes(e.target.value)} placeholder="E.g. Added 2m extension on north side" />
            </div>
            <Button
              className="w-full font-bold uppercase"
              onClick={handleCreateVariation}
              disabled={createVariation.isPending || !varTitle.trim()}
            >
              {createVariation.isPending ? "Creating..." : "Create Variation Quote"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
