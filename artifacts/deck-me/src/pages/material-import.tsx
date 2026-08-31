import {
  getListMaterialsQueryKey,
  useListMaterials,
  useUpdateMaterial,
  type Material,
} from "@workspace/api-client-react";
import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRightLeft,
  CheckCircle2,
  Database,
  FileSpreadsheet,
  Loader2,
  PackageCheck,
  Upload,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency } from "@/lib/format";
import {
  IMPORT_VENDORS,
  useSmartMaterialImport,
  type ImportVendor,
  type ImportedMaterialRow,
} from "@/lib/smart-material-import";

function rowMatch(row: ImportedMaterialRow, materials?: Material[]) {
  return row.matchedMaterialId
    ? materials?.find((material) => material.id === row.matchedMaterialId)
    : undefined;
}

export default function MaterialImport() {
  const { data: materials } = useListMaterials();
  const updateMaterial = useUpdateMaterial();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [applying, setApplying] = useState(false);
  const {
    selectedVendor,
    setSelectedVendor,
    phase,
    readingCount,
    rows,
    error,
    handleFile,
    parseText,
    alertRow,
    acceptSubstitute,
    declineSubstitute,
    quoteSubtotal,
    quoteTotal,
  } = useSmartMaterialImport(materials);

  const applyImport = async () => {
    const matchedRows = rows.filter((row) => row.matchedMaterialId);
    if (!matchedRows.length) return;
    setApplying(true);
    try {
      for (const row of matchedRows) {
        await updateMaterial.mutateAsync({
          id: row.matchedMaterialId!,
          data: {
            tradeCost: row.unitPrice,
            vendorName: row.vendorName,
            vendorSku: row.vendorSku,
          },
        });
      }
      await queryClient.invalidateQueries({ queryKey: getListMaterialsQueryKey() });
      toast({ title: `${matchedRows.length} material${matchedRows.length === 1 ? "" : "s"} updated` });
    } catch {
      toast({
        title: "Import could not be completed",
        description: "The matched materials were not all updated. Check the catalogue and try again.",
        variant: "destructive",
      });
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-primary">Smart supplier workflow</p>
          <h1 className="mt-1 text-3xl font-black uppercase tracking-tight">Material Import</h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Upload a vendor pricing sheet, match equivalent products, and keep the quote total current.
          </p>
        </div>
        <Button variant="outline" onClick={() => fileInputRef.current?.click()} className="font-bold uppercase">
          <Upload className="mr-2 h-4 w-4" /> Choose CSV
        </Button>
      </div>

      <Card className="border-2 border-primary/20 bg-primary/[0.03]">
        <CardContent className="grid gap-5 p-5 md:grid-cols-[1fr_auto] md:items-end">
          <div className="space-y-2">
            <Label htmlFor="import-vendor" className="font-bold uppercase text-xs">Selected vendor</Label>
            <Select value={selectedVendor} onValueChange={(value) => setSelectedVendor(value as ImportVendor)}>
              <SelectTrigger id="import-vendor" className="max-w-sm bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {IMPORT_VENDORS.map((vendor) => <SelectItem key={vendor} value={vendor}>{vendor}</SelectItem>)}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Matching uses the selected vendor and vendor SKU where available.
            </p>
          </div>
          <div className="flex items-center gap-3 rounded-md border bg-background px-4 py-3 text-sm">
            <Database className="h-4 w-4 text-primary" />
            <div>
              <p className="font-bold">Live catalogue matching</p>
              <p className="text-xs text-muted-foreground">{materials?.length ?? 0} catalogue items available</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) handleFile(file);
          event.target.value = "";
        }}
      />

      {phase === "idle" && (
        <Card className="border-2 border-dashed">
          <CardContent className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
            <FileSpreadsheet className="h-12 w-12 text-primary" />
            <div>
              <h2 className="text-xl font-black uppercase">Upload a vendor pricing sheet</h2>
              <p className="mt-1 text-sm text-muted-foreground">CSV columns supported: Item Name, Vendor SKU, Quantity, Unit Price, Stock.</p>
            </div>
            <Button onClick={() => fileInputRef.current?.click()} className="font-bold uppercase">
              <Upload className="mr-2 h-4 w-4" /> Select pricing CSV
            </Button>
            <button
              type="button"
              className="text-xs font-bold text-primary underline underline-offset-4"
              onClick={() => parseText(`Item Name,Vendor SKU,Quantity,Unit Price,Stock\n140x45mm Merbau Decking,FIN-MERB-14045,12,74.50,Out of Stock\nGalvanised Decking Screws,FIN-SCREW-316,4,18.20,In Stock`)}
            >
              Load stakeholder demo CSV
            </button>
          </CardContent>
        </Card>
      )}

      {phase === "reading" && (
        <Card className="border-2 border-primary/30">
          <CardContent className="flex items-center gap-4 p-6">
            <Loader2 className="h-7 w-7 animate-spin text-primary" />
            <div className="flex-1">
              <p className="text-lg font-black">Reading {readingCount} item{readingCount === 1 ? "" : "s"}...</p>
              <p className="text-sm text-muted-foreground">Normalising vendor SKUs and matching catalogue items.</p>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                <div className="h-full w-2/3 animate-pulse rounded-full bg-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {phase === "error" && (
        <Card className="border-2 border-destructive/30">
          <CardContent className="flex items-center gap-3 p-5 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            <p className="font-bold">{error}</p>
          </CardContent>
        </Card>
      )}

      {phase === "ready" && (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Card><CardContent className="p-5"><p className="text-xs font-bold uppercase text-muted-foreground">Imported items</p><p className="mt-1 text-3xl font-black">{rows.length}</p></CardContent></Card>
            <Card><CardContent className="p-5"><p className="text-xs font-bold uppercase text-muted-foreground">Catalogue matches</p><p className="mt-1 text-3xl font-black">{rows.filter((row) => row.matchedMaterialId).length}</p></CardContent></Card>
            <Card className="border-primary/30 bg-primary/[0.04]"><CardContent className="p-5"><p className="text-xs font-bold uppercase text-muted-foreground">Recalculated quote total</p><p className="mt-1 text-3xl font-black text-primary">{formatCurrency(quoteTotal)}</p><p className="text-xs text-muted-foreground">Including 10% GST, subtotal {formatCurrency(quoteSubtotal)}</p></CardContent></Card>
          </div>

          <Card className="overflow-hidden border-2">
            <CardHeader className="border-b bg-muted/30">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle className="font-black uppercase">Parsed pricing lines</CardTitle>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} className="font-bold uppercase">Replace CSV</Button>
                  <Button size="sm" onClick={applyImport} disabled={applying || !rows.some((row) => row.matchedMaterialId)} className="font-bold uppercase">
                    {applying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Database className="mr-2 h-4 w-4" />}
                    Apply catalogue updates
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-sm">
                  <thead className="border-b bg-muted/20">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-bold uppercase text-muted-foreground">Material</th>
                      <th className="px-3 py-3 text-left text-xs font-bold uppercase text-muted-foreground">Vendor</th>
                      <th className="px-3 py-3 text-left text-xs font-bold uppercase text-muted-foreground">SKU</th>
                      <th className="px-3 py-3 text-right text-xs font-bold uppercase text-muted-foreground">Qty</th>
                      <th className="px-3 py-3 text-right text-xs font-bold uppercase text-muted-foreground">Unit price</th>
                      <th className="px-4 py-3 text-right text-xs font-bold uppercase text-muted-foreground">Line total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {rows.map((row) => (
                      <tr key={row.id} className={row.isSubstituted ? "bg-emerald-500/[0.08]" : ""}>
                        <td className="px-4 py-4">
                          <p className="font-bold">{row.name}</p>
                          <div className="mt-1 flex flex-wrap gap-1">
                            {row.isSubstituted && <Badge className="bg-emerald-600 text-white"><ArrowRightLeft className="mr-1 h-3 w-3" /> Substituted</Badge>}
                            {row.matchedMaterialId ? <Badge variant="outline"><CheckCircle2 className="mr-1 h-3 w-3 text-emerald-600" /> Matched</Badge> : <Badge variant="secondary">New item</Badge>}
                          </div>
                        </td>
                        <td className="px-3 py-4 font-medium">{row.vendorName}<div className={`text-xs ${row.stockStatus.toLowerCase().includes("out") ? "text-destructive" : "text-emerald-600"}`}>{row.stockStatus}</div></td>
                        <td className="px-3 py-4 font-mono text-xs text-muted-foreground">{row.vendorSku}</td>
                        <td className="px-3 py-4 text-right font-mono">{row.quantity}</td>
                        <td className="px-3 py-4 text-right font-mono">{formatCurrency(row.unitPrice)}</td>
                        <td className="px-4 py-4 text-right font-mono font-bold">{formatCurrency(row.quantity * row.unitPrice)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <PackageCheck className="h-4 w-4 text-primary" />
            Vendor fields are saved with the matched catalogue item for future live API integrations.
          </div>
        </>
      )}

      <Dialog open={Boolean(alertRow)} onOpenChange={(open) => { if (!open) declineSubstitute(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-black uppercase">
              <ArrowRightLeft className="h-5 w-5 text-primary" /> Cross-vendor match
            </DialogTitle>
            <DialogDescription className="sr-only">
              Review an equivalent in-stock material from another vendor.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-4 text-sm leading-6">
            Item &quot;140x45mm Merbau Decking&quot; is out of stock at Finlaysons. Would you like to substitute with the equivalent from Bunnings Trade (In Stock)?
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button variant="outline" onClick={declineSubstitute}>Keep Finlaysons item</Button>
            <Button onClick={acceptSubstitute} className="font-bold">Accept Substitute</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}