import { useListMaterials, useCreateMaterial, useUpdateMaterial, useDeleteMaterial, getListMaterialsQueryKey } from "@workspace/api-client-react";
import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { formatCurrency } from "@/lib/format";
import { Box, Plus, MoreVertical, Edit2, Trash2, TrendingUp, Upload, FileText, CheckCircle, XCircle } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import type { Material } from "@workspace/api-client-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";

type CsvRow = { name: string; sku?: string; tradeCost: number };

function parseTradeCsvText(text: string): CsvRow[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const header = lines[0].split(",").map(h => h.trim().toLowerCase().replace(/[^a-z0-9]/g, "_"));
  const nameIdx = header.findIndex(h => h.includes("name") || h.includes("material"));
  const skuIdx = header.findIndex(h => h.includes("sku") || h.includes("code") || h.includes("part"));
  const priceIdx = header.findIndex(h => h.includes("trade") || h.includes("cost") || h.includes("price") || h.includes("buy"));
  if (priceIdx === -1 || nameIdx === -1) return [];

  const rows: CsvRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(",").map(c => c.trim().replace(/^"|"$/g, ""));
    const name = cells[nameIdx] || "";
    const sku = skuIdx >= 0 ? cells[skuIdx] : undefined;
    const rawPrice = cells[priceIdx]?.replace(/[^0-9.]/g, "");
    const tradeCost = parseFloat(rawPrice);
    if (name && !isNaN(tradeCost) && tradeCost > 0) {
      rows.push({ name, sku: sku || undefined, tradeCost });
    }
  }
  return rows;
}

export default function Materials() {
  const { data: materials, isLoading } = useListMaterials();
  const createMaterial = useCreateMaterial();
  const updateMaterial = useUpdateMaterial();
  const deleteMaterial = useDeleteMaterial();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({
    name: "", sku: "", category: "decking", unit: "metre", unitPrice: 0,
    tradeCost: "" as number | "", packSize: 1, supplier: "bunnings", notes: ""
  });

  const [csvDialogOpen, setCsvDialogOpen] = useState(false);
  const [csvImporting, setCsvImporting] = useState(false);
  const [csvPreview, setCsvPreview] = useState<Array<{ row: CsvRow; matched?: Material; status?: "updated" | "not_found" }>>([]);
  const [csvDone, setCsvDone] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleOpenCreate = () => {
    setEditingId(null);
    setForm({ name: "", sku: "", category: "decking", unit: "metre", unitPrice: 0, tradeCost: "", packSize: 1, supplier: "bunnings", notes: "" });
    setOpen(true);
  };

  const handleOpenEdit = (m: Material) => {
    setEditingId(m.id);
    setForm({
      name: m.name, sku: m.sku || "", category: m.category, unit: m.unit, unitPrice: m.unitPrice,
      tradeCost: (m as any).tradeCost ?? "", packSize: m.packSize || 1, supplier: m.supplier, notes: m.notes || ""
    });
    setOpen(true);
  };

  const handleSave = () => {
    const payload = { ...form, tradeCost: form.tradeCost === "" ? undefined : Number(form.tradeCost) };
    if (editingId) {
      updateMaterial.mutate({ id: editingId, data: payload }, {
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListMaterialsQueryKey() }); setOpen(false); toast({ title: "Material updated" }); }
      });
    } else {
      createMaterial.mutate({ data: payload }, {
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListMaterialsQueryKey() }); setOpen(false); toast({ title: "Material created" }); }
      });
    }
  };

  const handleDelete = (id: number) => {
    if (confirm("Delete this material?")) {
      deleteMaterial.mutate({ id }, {
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListMaterialsQueryKey() }); toast({ title: "Material deleted" }); }
      });
    }
  };

  const handleCsvFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const rows = parseTradeCsvText(text);
      if (!rows.length) {
        toast({ title: "No valid rows found — check your CSV has Name and Trade Cost columns", variant: "destructive" });
        return;
      }
      const preview = rows.map(row => {
        const matched = materials?.find(m =>
          (row.sku && m.sku && m.sku.toLowerCase() === row.sku.toLowerCase()) ||
          m.name.toLowerCase() === row.name.toLowerCase()
        );
        return { row, matched };
      });
      setCsvPreview(preview);
      setCsvDone(false);
      setCsvDialogOpen(true);
      e.target.value = "";
    };
    reader.readAsText(file);
  };

  const handleRunImport = async () => {
    setCsvImporting(true);
    const updated: typeof csvPreview = [];
    for (const item of csvPreview) {
      if (!item.matched) {
        updated.push({ ...item, status: "not_found" });
        continue;
      }
      await updateMaterial.mutateAsync({ id: item.matched.id, data: { tradeCost: item.row.tradeCost } });
      updated.push({ ...item, status: "updated" });
    }
    setCsvPreview(updated);
    setCsvImporting(false);
    setCsvDone(true);
    queryClient.invalidateQueries({ queryKey: getListMaterialsQueryKey() });
    const updatedCount = updated.filter(i => i.status === "updated").length;
    toast({ title: `${updatedCount} material${updatedCount !== 1 ? "s" : ""} updated from CSV` });
  };

  const getMargin = (m: Material) => {
    const tc = (m as any).tradeCost;
    if (!tc || !m.unitPrice) return null;
    return Math.round(((m.unitPrice - tc) / m.unitPrice) * 100);
  };

  const grouped = materials?.reduce((acc, m) => {
    if (!acc[m.category]) acc[m.category] = [];
    acc[m.category].push(m);
    return acc;
  }, {} as Record<string, typeof materials>);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tight">Materials</h1>
          <p className="text-muted-foreground font-medium">Catalogue pricing — trade cost is internal only</p>
        </div>
        <div className="flex gap-2">
          <input ref={fileInputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleCsvFile} />
          <Button variant="outline" onClick={() => fileInputRef.current?.click()} className="font-bold uppercase">
            <Upload className="w-4 h-4 mr-2" /> Import Trade CSV
          </Button>
          <Link href="/materials/import">
            <Button variant="outline" className="font-bold uppercase">
              <FileText className="mr-2 h-4 w-4" /> Smart Material Import
            </Button>
          </Link>
          <Dialog open={open} onOpenChange={setOpen}>
            <Button onClick={handleOpenCreate} className="font-bold uppercase">
              <Plus className="w-4 h-4 mr-2" /> Add Material
            </Button>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="font-display font-black uppercase text-xl">
                  {editingId ? "Edit Material" : "New Material"}
                </DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-4 py-4">
                <div className="col-span-2 space-y-2">
                  <Label>Name</Label>
                  <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select value={form.category} onValueChange={v => setForm({ ...form, category: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["decking","joist","bearer","post","screw","clip","bracket","sealant","handrail","balustrade","stair_stringer","stair_tread","fascia","fencing_post","fencing_rail","fencing_paling","other"].map(c => (
                        <SelectItem key={c} value={c}>{c.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Unit</Label>
                  <Select value={form.unit} onValueChange={v => setForm({ ...form, unit: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["metre","each","pack","bag"].map(u => (
                        <SelectItem key={u} value={u}>{u.charAt(0).toUpperCase() + u.slice(1)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Retail Price (AUD)</Label>
                  <Input type="number" step="0.01" value={form.unitPrice} onChange={e => setForm({ ...form, unitPrice: parseFloat(e.target.value) || 0 })} />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-1">
                    Trade Cost (AUD) <span className="text-xs text-emerald-600 font-bold">🔒 internal</span>
                  </Label>
                  <Input
                    type="number" step="0.01" placeholder="Your buy price"
                    value={form.tradeCost}
                    onChange={e => setForm({ ...form, tradeCost: e.target.value === "" ? "" : parseFloat(e.target.value) })}
                    className="border-emerald-500/40 focus-visible:ring-emerald-500"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Supplier</Label>
                  <Select value={form.supplier} onValueChange={v => setForm({ ...form, supplier: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["bunnings","mitre10","local","other"].map(s => (
                        <SelectItem key={s} value={s}>{s === "mitre10" ? "Mitre 10" : s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>SKU</Label>
                  <Input value={form.sku} onChange={e => setForm({ ...form, sku: e.target.value })} placeholder="Optional" />
                </div>
                <div className="col-span-2 mt-4">
                  <Button onClick={handleSave} className="w-full font-bold uppercase" disabled={!form.name || createMaterial.isPending || updateMaterial.isPending}>
                    Save
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* CSV Import Dialog */}
      <Dialog open={csvDialogOpen} onOpenChange={o => { if (!o) { setCsvDialogOpen(false); setCsvPreview([]); setCsvDone(false); } }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-display font-black uppercase text-xl flex items-center gap-2">
              <FileText className="w-5 h-5" /> Import Trade Prices
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              CSV must have columns: <code className="bg-muted px-1 rounded text-xs">Name</code> (or Material) and{" "}
              <code className="bg-muted px-1 rounded text-xs">Trade Cost</code> (or Cost/Price/Buy). Optional:{" "}
              <code className="bg-muted px-1 rounded text-xs">SKU</code>.
            </p>
            <div className="border rounded-lg overflow-hidden max-h-80 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/60 border-b">
                  <tr>
                    <th className="text-left px-3 py-2 font-bold uppercase text-xs text-muted-foreground">Name</th>
                    <th className="text-left px-3 py-2 font-bold uppercase text-xs text-muted-foreground">SKU</th>
                    <th className="text-right px-3 py-2 font-bold uppercase text-xs text-muted-foreground">Trade Cost</th>
                    <th className="text-left px-3 py-2 font-bold uppercase text-xs text-muted-foreground">Match</th>
                    {csvDone && <th className="text-left px-3 py-2 font-bold uppercase text-xs text-muted-foreground">Result</th>}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {csvPreview.map((item, i) => (
                    <tr key={i} className={item.matched ? "bg-emerald-500/5" : "bg-red-500/5"}>
                      <td className="px-3 py-2 font-medium">{item.row.name}</td>
                      <td className="px-3 py-2 text-muted-foreground text-xs">{item.row.sku || "—"}</td>
                      <td className="px-3 py-2 text-right font-mono font-bold">{formatCurrency(item.row.tradeCost)}</td>
                      <td className="px-3 py-2">
                        {item.matched ? (
                          <span className="text-emerald-600 text-xs font-bold flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" /> {item.matched.name}
                          </span>
                        ) : (
                          <span className="text-red-500 text-xs font-bold flex items-center gap-1">
                            <XCircle className="w-3 h-3" /> No match
                          </span>
                        )}
                      </td>
                      {csvDone && (
                        <td className="px-3 py-2">
                          {item.status === "updated" && <span className="text-emerald-600 text-xs font-bold">✓ Updated</span>}
                          {item.status === "not_found" && <span className="text-muted-foreground text-xs">Skipped</span>}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
              <span>
                {csvPreview.filter(i => i.matched).length} of {csvPreview.length} rows matched
              </span>
              {!csvDone && (
                <Button
                  onClick={handleRunImport}
                  disabled={csvImporting || !csvPreview.some(i => i.matched)}
                  className="font-bold uppercase"
                >
                  {csvImporting ? "Updating..." : `Update ${csvPreview.filter(i => i.matched).length} Materials`}
                </Button>
              )}
              {csvDone && (
                <Button variant="outline" onClick={() => { setCsvDialogOpen(false); setCsvPreview([]); setCsvDone(false); }} className="font-bold uppercase">
                  Done
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {isLoading ? (
        <div className="space-y-4"><div className="h-64 bg-muted animate-pulse rounded-lg" /></div>
      ) : !materials?.length ? (
        <div className="text-center py-20 border-2 border-dashed rounded-lg">
          <Box className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-xl font-bold uppercase mb-2">No Materials</h2>
          <p className="text-muted-foreground mb-6">Build your catalogue to generate quotes.</p>
          <Button onClick={handleOpenCreate} className="font-bold uppercase"><Plus className="w-4 h-4 mr-2" /> Add Material</Button>
        </div>
      ) : (
        <div className="space-y-8">
          <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg px-4 py-2 border">
            💡 <strong>CSV tip:</strong> Export your trade pricing from your supplier, then import it here to bulk-update trade costs.
            Your spreadsheet needs a <code>Name</code> column and a <code>Trade Cost</code> (or Cost/Price) column. Matching is done by name or SKU.
          </p>
          {grouped && Object.entries(grouped).map(([category, items]) => (
            <Card key={category} className="border-2 shadow-sm overflow-hidden">
              <CardHeader className="bg-muted/50 border-b">
                <CardTitle className="font-display font-black uppercase text-lg">{category}</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y">
                  {items.map(m => {
                    const margin = getMargin(m);
                    const tc = (m as any).tradeCost;
                    return (
                      <div key={m.id} className="p-4 flex justify-between items-center hover:bg-muted/20 group">
                        <div>
                          <div className="font-bold">{m.name}</div>
                          <div className="text-xs text-muted-foreground font-medium uppercase mt-1">
                            {m.supplier} {m.sku && `• ${m.sku}`}
                          </div>
                        </div>
                        <div className="flex items-center gap-6">
                          <div className="text-right">
                            <div className="font-mono font-black text-lg">{formatCurrency(m.unitPrice)}</div>
                            <div className="text-xs text-muted-foreground">retail / {m.unit}</div>
                          </div>
                          {tc != null ? (
                            <div className="text-right hidden md:block">
                              <div className="font-mono font-bold text-sm text-emerald-600">{formatCurrency(tc)}</div>
                              <div className="text-xs text-muted-foreground">trade cost</div>
                              {margin !== null && (
                                <Badge variant="outline" className="text-xs mt-1 text-emerald-600 border-emerald-500/30">
                                  <TrendingUp className="w-3 h-3 mr-1" />{margin}% margin
                                </Badge>
                              )}
                            </div>
                          ) : (
                            <div className="text-right hidden md:block">
                              <div className="text-xs text-muted-foreground italic">no trade cost</div>
                            </div>
                          )}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100"><MoreVertical className="w-4 h-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleOpenEdit(m)}><Edit2 className="w-4 h-4 mr-2" /> Edit</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleDelete(m.id)} className="text-destructive"><Trash2 className="w-4 h-4 mr-2" /> Delete</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
