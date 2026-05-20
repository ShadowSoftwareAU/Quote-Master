import { useState, useEffect } from "react";
import { useEstimateDeck, useCreateQuote, useListCustomers } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/format";
import { Calculator as CalcIcon, Save, Loader2, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Calculator() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [spec, setSpec] = useState({
    lengthM: 5,
    widthM: 4,
    heightM: 0.5,
    boardWidthMm: 90,
    joistSpacingMm: 450,
    bearerSpacingMm: 1500,
    postSpacingMm: 1500,
    wastageFactor: 1.1,
    labourHours: 24,
    labourRate: 85
  });

  const estimate = useEstimateDeck();
  const createQuote = useCreateQuote();
  const { data: customers } = useListCustomers();

  const [quoteTitle, setQuoteTitle] = useState("New Deck Quote");
  const [customerId, setCustomerId] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      estimate.mutate({ data: spec });
    }, 500);
    return () => clearTimeout(timer);
  }, [spec]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSpec({ ...spec, [e.target.name]: parseFloat(e.target.value) || 0 });
  };

  const handleSaveQuote = () => {
    if (!customerId) {
      toast({ title: "Select a customer", variant: "destructive" });
      return;
    }
    createQuote.mutate(
      { data: { ...spec, title: quoteTitle, customerId: parseInt(customerId) } },
      {
        onSuccess: (data) => {
          toast({ title: "Quote saved!" });
          setDialogOpen(false);
          setLocation(`/quotes/${data.id}`);
        }
      }
    );
  };

  const estData = estimate.data;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <CalcIcon className="w-8 h-8 text-primary" />
        <h1 className="text-3xl font-black uppercase tracking-tight">Deck Calculator</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 space-y-6">
          <Card className="border-2 border-border shadow-sm">
            <CardHeader className="bg-muted/50 border-b pb-4">
              <CardTitle className="font-display font-black uppercase flex items-center justify-between">
                Dimensions
                {estimate.isPending && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="font-bold uppercase text-xs">Length (m)</Label>
                  <Input type="number" step="0.1" name="lengthM" value={spec.lengthM} onChange={handleChange} className="font-mono text-lg h-12" />
                </div>
                <div className="space-y-2">
                  <Label className="font-bold uppercase text-xs">Width (m)</Label>
                  <Input type="number" step="0.1" name="widthM" value={spec.widthM} onChange={handleChange} className="font-mono text-lg h-12" />
                </div>
                <div className="space-y-2">
                  <Label className="font-bold uppercase text-xs">Height (m)</Label>
                  <Input type="number" step="0.1" name="heightM" value={spec.heightM} onChange={handleChange} className="font-mono text-lg h-12" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-2 border-border shadow-sm">
            <CardHeader className="bg-muted/50 border-b pb-4">
              <CardTitle className="font-display font-black uppercase">Specs</CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="font-bold uppercase text-xs">Board Width (mm)</Label>
                  <Input type="number" name="boardWidthMm" value={spec.boardWidthMm} onChange={handleChange} className="font-mono" />
                </div>
                <div className="space-y-2">
                  <Label className="font-bold uppercase text-xs">Joist Spacing (mm)</Label>
                  <Input type="number" name="joistSpacingMm" value={spec.joistSpacingMm} onChange={handleChange} className="font-mono" />
                </div>
                <div className="space-y-2">
                  <Label className="font-bold uppercase text-xs">Labour Hours</Label>
                  <Input type="number" name="labourHours" value={spec.labourHours} onChange={handleChange} className="font-mono" />
                </div>
                <div className="space-y-2">
                  <Label className="font-bold uppercase text-xs">Labour Rate ($/hr)</Label>
                  <Input type="number" name="labourRate" value={spec.labourRate} onChange={handleChange} className="font-mono" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-7">
          <Card className="border-2 border-primary/20 shadow-xl bg-card overflow-hidden sticky top-4">
            <div className="bg-primary p-6 text-primary-foreground">
              <h2 className="text-sm font-bold uppercase tracking-widest opacity-80 mb-1">Estimated Total</h2>
              <div className="text-5xl font-black tracking-tighter">
                {estData ? formatCurrency(estData.total) : "$0.00"}
              </div>
            </div>
            
            <CardContent className="p-0">
              {estData && (
                <div className="divide-y divide-border">
                  <div className="p-4 bg-muted/20 flex justify-between items-center text-sm font-bold">
                    <span className="uppercase">Materials Subtotal</span>
                    <span className="font-mono text-base">{formatCurrency(estData.materialsSubtotal)}</span>
                  </div>
                  <div className="p-4 bg-muted/20 flex justify-between items-center text-sm font-bold">
                    <span className="uppercase">Labour Cost</span>
                    <span className="font-mono text-base">{formatCurrency(estData.labourCost)}</span>
                  </div>
                  <div className="p-4 bg-muted/20 flex justify-between items-center text-sm font-bold">
                    <span className="uppercase">GST (10%)</span>
                    <span className="font-mono text-base">{formatCurrency(estData.gst)}</span>
                  </div>
                  
                  <div className="p-4 space-y-3 max-h-[300px] overflow-auto">
                    <h3 className="font-bold uppercase text-xs text-muted-foreground mb-2">Bill of Materials</h3>
                    {estData.lines.map((line, i) => (
                      <div key={i} className="flex justify-between items-start text-sm">
                        <div>
                          <div className="font-medium text-foreground">{line.description}</div>
                          <div className="text-xs text-muted-foreground">{line.quantity} {line.unit} @ {formatCurrency(line.unitPrice)}</div>
                        </div>
                        <div className="font-mono font-medium">{formatCurrency(line.lineTotal)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
            <CardFooter className="p-4 border-t bg-muted/10">
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="w-full h-14 text-lg font-black uppercase rounded-sm" disabled={!estData}>
                    <Save className="w-5 h-5 mr-2" /> Save as Quote
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle className="font-display font-black uppercase text-xl">Save Quote</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label className="font-bold uppercase text-xs">Quote Title</Label>
                      <Input value={quoteTitle} onChange={e => setQuoteTitle(e.target.value)} placeholder="E.g. Smith Deck" />
                    </div>
                    <div className="space-y-2">
                      <Label className="font-bold uppercase text-xs">Customer</Label>
                      <Select value={customerId} onValueChange={setCustomerId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a customer" />
                        </SelectTrigger>
                        <SelectContent>
                          {customers?.map(c => (
                            <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button 
                      className="w-full h-12 font-black uppercase" 
                      onClick={handleSaveQuote}
                      disabled={createQuote.isPending}
                    >
                      {createQuote.isPending ? <Loader2 className="animate-spin w-5 h-5" /> : "Save & Continue"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
}
