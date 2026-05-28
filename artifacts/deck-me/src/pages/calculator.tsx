import { useState, useEffect, useMemo } from "react";
import {
  useEstimateDeck,
  useCreateQuote,
  useListCustomers,
  useListMaterials,
  type Material,
} from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/format";
import {
  Calculator as CalcIcon,
  Save,
  Loader2,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  ShoppingCart,
  TrendingDown,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const COUNCIL_HEIGHT_M = 1.0;

const SUPPLIER_LABELS: Record<string, string> = {
  bunnings: "Bunnings",
  mitre10: "Mitre 10",
  bretts_trade: "Bretts Trade",
  finlaysons: "Finlaysons",
  local: "Local Yard",
  other: "Other",
};
const SUPPLIER_COLORS: Record<string, string> = {
  bunnings: "#d41f1f",
  mitre10: "#007a3d",
  bretts_trade: "#1d4ed8",
  finlaysons: "#7c3aed",
  local: "#b45309",
  other: "#6b7280",
};

function supplierLabel(s: string) {
  return SUPPLIER_LABELS[s.toLowerCase()] ?? s;
}
function supplierColor(s: string) {
  return SUPPLIER_COLORS[s.toLowerCase()] ?? "#6b7280";
}

interface SupplierPrice {
  supplier: string;
  unitPrice: number;
  sku: string | null;
}

interface EnrichedLine {
  description: string;
  category: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  lineTotal: number;
  supplierPrices: SupplierPrice[];
  cheapestTotal: number;
}

const DEFAULT_SPEC = {
  lengthM: 5,
  widthM: 4,
  heightM: 0.5,
  boardWidthMm: 90,
  gapSpacingMm: 4,
  joistSpacingMm: 450,
  bearerSpacingMm: 1500,
  postSpacingMm: 1500,
  wastageFactor: 1.1,
  labourHours: 24,
  labourRate: 85,
  deckBoardType: "treated_pine",
  subframeType: "stumps",
  fastenerType: "screws",
  fasciaType: "none",
  includeHandrails: false,
  handrailHeightMm: 1000,
  balustradeType: "timber",
  timberGapMm: 15,
  wireSpacingMm: 100,
  includeStairs: false,
  stairFlights: 1,
  includeFencing: false,
  fencingSides: 1,
  fencingHeightM: 1.8,
  fencingWidthM: 1.8,
  includeAwning: false,
  awningWidthM: 3,
  awningLengthM: 3,
};

export default function Calculator() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [spec, setSpec] = useState(DEFAULT_SPEC);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const estimate = useEstimateDeck();
  const createQuote = useCreateQuote();
  const { data: customers } = useListCustomers();
  const { data: materials } = useListMaterials();

  const [quoteTitle, setQuoteTitle] = useState("New Deck Quote");
  const [customerId, setCustomerId] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  const councilWarning = spec.heightM >= COUNCIL_HEIGHT_M;

  useEffect(() => {
    const timer = setTimeout(() => {
      estimate.mutate({ data: spec });
    }, 400);
    return () => clearTimeout(timer);
  }, [spec]);

  const setNum = (key: string, val: string) =>
    setSpec((s) => ({ ...s, [key]: parseFloat(val) || 0 }));
  const setStr = (key: string, val: string) =>
    setSpec((s) => ({ ...s, [key]: val }));
  const setBool = (key: string, val: boolean) =>
    setSpec((s) => ({ ...s, [key]: val }));

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setNum(e.target.name, e.target.value);

  // ── Material lookup for supplier comparison ──
  const materialById = useMemo(() => {
    if (!materials) return new Map<number, Material>();
    return new Map(materials.map((m) => [m.id, m]));
  }, [materials]);

  const materialsByCategory = useMemo(() => {
    if (!materials) return new Map<string, Material[]>();
    const map = new Map<string, Material[]>();
    for (const m of materials) {
      if (!map.has(m.category)) map.set(m.category, []);
      map.get(m.category)!.push(m);
    }
    return map;
  }, [materials]);

  const enrichedLines = useMemo<EnrichedLine[]>(() => {
    if (!estimate.data) return [];
    return estimate.data.lines.map((l) => {
      let group: Material[] = [];
      if (l.materialId != null) {
        const m = materialById.get(l.materialId);
        if (m) group = materialsByCategory.get(m.category) ?? [];
      }
      if (group.length === 0) {
        group = materialsByCategory.get(l.category) ?? [];
      }
      const bySupplier = new Map<string, SupplierPrice>();
      for (const m of group) {
        const existing = bySupplier.get(m.supplier);
        if (!existing || Number(m.unitPrice) < existing.unitPrice) {
          bySupplier.set(m.supplier, {
            supplier: m.supplier,
            unitPrice: Number(m.unitPrice),
            sku: m.sku ?? null,
          });
        }
      }
      const supplierPrices = Array.from(bySupplier.values()).sort(
        (a, b) => a.unitPrice - b.unitPrice,
      );
      const cheapestTotal =
        supplierPrices.length > 0
          ? supplierPrices[0].unitPrice * l.quantity
          : l.lineTotal;
      return { ...l, supplierPrices, cheapestTotal };
    });
  }, [estimate.data, materialById, materialsByCategory]);

  const supplierTotals = useMemo(() => {
    if (enrichedLines.length === 0) return [];
    const supplierSet = new Set<string>();
    for (const line of enrichedLines)
      for (const p of line.supplierPrices) supplierSet.add(p.supplier);
    if (supplierSet.size < 2) return [];
    return Array.from(supplierSet)
      .map((supplier) => {
        let total = 0;
        let covered = 0;
        for (const line of enrichedLines) {
          const p = line.supplierPrices.find((sp) => sp.supplier === supplier);
          if (p) { total += p.unitPrice * line.quantity; covered++; }
          else total += line.cheapestTotal;
        }
        return { supplier, total, covered };
      })
      .sort((a, b) => a.total - b.total);
  }, [enrichedLines]);

  const estData = estimate.data;

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
        },
      },
    );
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <CalcIcon className="w-8 h-8 text-primary" />
        <h1 className="text-3xl font-black uppercase tracking-tight">Deck Calculator</h1>
        {estimate.isPending && (
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground ml-2" />
        )}
      </div>

      {councilWarning && (
        <div className="flex items-start gap-3 bg-red-600 text-white rounded-lg px-5 py-4 border-2 border-red-700 shadow-lg">
          <AlertTriangle className="w-6 h-6 shrink-0 mt-0.5" />
          <div>
            <div className="font-black uppercase text-sm tracking-wide">
              Council Certification May Be Required
            </div>
            <div className="text-sm mt-0.5 text-red-100">
              Deck height {spec.heightM.toFixed(2)}m exceeds 1.0m. In most Australian councils,
              decks over 1m require a building permit and structural engineer sign-off.
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* ── LEFT: Inputs ── */}
        <div className="lg:col-span-5 space-y-4">

          {/* Dimensions */}
          <Card className="border-2">
            <CardHeader className="bg-muted/50 border-b pb-3 pt-4 px-5">
              <CardTitle className="font-black uppercase text-sm tracking-wider">Dimensions</CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="font-bold uppercase text-xs">Length (m)</Label>
                  <Input type="number" step="0.1" name="lengthM" value={spec.lengthM} onChange={handleChange} className="font-mono text-lg h-11" />
                </div>
                <div className="space-y-1.5">
                  <Label className="font-bold uppercase text-xs">Width (m)</Label>
                  <Input type="number" step="0.1" name="widthM" value={spec.widthM} onChange={handleChange} className="font-mono text-lg h-11" />
                </div>
                <div className="space-y-1.5">
                  <Label className={`font-bold uppercase text-xs flex items-center gap-1 ${councilWarning ? "text-red-600" : ""}`}>
                    Height (m)
                    {councilWarning && <AlertTriangle className="w-3 h-3" />}
                  </Label>
                  <Input
                    type="number" step="0.1" name="heightM" value={spec.heightM} onChange={handleChange}
                    className={`font-mono text-lg h-11 ${councilWarning ? "border-red-500 focus-visible:ring-red-500" : ""}`}
                  />
                </div>
              </div>
              {estData && (
                <div className="text-xs text-muted-foreground bg-muted/30 rounded px-3 py-2">
                  Deck area: <span className="font-bold text-foreground">{estData.deckAreaM2}m²</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Board + Gap */}
          <Card className="border-2">
            <CardHeader className="bg-muted/50 border-b pb-3 pt-4 px-5">
              <CardTitle className="font-black uppercase text-sm tracking-wider">Decking</CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              <div className="space-y-1.5">
                <Label className="font-bold uppercase text-xs">Board Type</Label>
                <Select value={spec.deckBoardType} onValueChange={(v) => setStr("deckBoardType", v)}>
                  <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="treated_pine">Treated Pine</SelectItem>
                    <SelectItem value="hardwood">Hardwood (Merbau / Spotted Gum)</SelectItem>
                    <SelectItem value="composite">Composite (e.g. Trex, ModWood)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="font-bold uppercase text-xs">Board Width (mm)</Label>
                  <Input type="number" name="boardWidthMm" value={spec.boardWidthMm} onChange={handleChange} className="font-mono h-10" />
                </div>
                <div className="space-y-1.5">
                  <Label className="font-bold uppercase text-xs text-primary">Gap Spacing (mm)</Label>
                  <Input
                    type="number" name="gapSpacingMm" value={spec.gapSpacingMm} onChange={handleChange}
                    className="font-mono h-10 border-primary/40 focus-visible:ring-primary"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="font-bold uppercase text-xs">Fastener Type</Label>
                <Select value={spec.fastenerType} onValueChange={(v) => setStr("fastenerType", v)}>
                  <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="screws">Face Screws</SelectItem>
                    <SelectItem value="hidden_clips">Hidden Clips</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="font-bold uppercase text-xs">Fascia</Label>
                <Select value={spec.fasciaType} onValueChange={(v) => setStr("fasciaType", v)}>
                  <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Fascia</SelectItem>
                    <SelectItem value="timber">Timber Fascia</SelectItem>
                    <SelectItem value="composite">Composite Fascia</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Framing */}
          <Card className="border-2">
            <CardHeader className="bg-muted/50 border-b pb-3 pt-4 px-5">
              <CardTitle className="font-black uppercase text-sm tracking-wider">Framing</CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              <div className="space-y-1.5">
                <Label className="font-bold uppercase text-xs">Subframe Type</Label>
                <Select value={spec.subframeType} onValueChange={(v) => setStr("subframeType", v)}>
                  <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="stumps">Stumps / Posts</SelectItem>
                    <SelectItem value="concrete_slab">Concrete Slab</SelectItem>
                    <SelectItem value="existing_structure">Existing Structure</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="font-bold uppercase text-xs">Joist Spacing (mm)</Label>
                  <Input type="number" name="joistSpacingMm" value={spec.joistSpacingMm} onChange={handleChange} className="font-mono h-10" />
                </div>
                <div className="space-y-1.5">
                  <Label className="font-bold uppercase text-xs">Bearer Spacing (mm)</Label>
                  <Input type="number" name="bearerSpacingMm" value={spec.bearerSpacingMm} onChange={handleChange} className="font-mono h-10" />
                </div>
                {spec.subframeType === "stumps" && (
                  <div className="space-y-1.5 col-span-2">
                    <Label className="font-bold uppercase text-xs">Post Spacing (mm)</Label>
                    <Input type="number" name="postSpacingMm" value={spec.postSpacingMm} onChange={handleChange} className="font-mono h-10" />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Extras — checkboxes */}
          <Card className="border-2">
            <CardHeader className="bg-muted/50 border-b pb-3 pt-4 px-5">
              <CardTitle className="font-black uppercase text-sm tracking-wider">Extras</CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-4">

              {/* Handrails */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="includeHandrails"
                      checked={spec.includeHandrails}
                      onCheckedChange={(v) => setBool("includeHandrails", !!v)}
                    />
                    <Label htmlFor="includeHandrails" className="font-bold cursor-pointer">
                      Handrails / Balustrade
                    </Label>
                  </div>
                  {spec.includeHandrails && (
                    <Badge variant="secondary" className="text-xs">Auto-calc 3 sides + stairs</Badge>
                  )}
                </div>
                {spec.includeHandrails && (
                  <div className="pl-7 space-y-3">
                    <div className="space-y-1.5">
                      <Label className="font-bold uppercase text-xs">Handrail Height (mm)</Label>
                      <Input
                        type="number" min="600" max="1200" step="50" name="handrailHeightMm"
                        value={spec.handrailHeightMm} onChange={handleChange}
                        className="font-mono h-9 w-28"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="font-bold uppercase text-xs">Balustrade Infill</Label>
                      <Select value={spec.balustradeType} onValueChange={(v) => setStr("balustradeType", v)}>
                        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="timber">Timber Pickets</SelectItem>
                          <SelectItem value="stainless_cable">Stainless Cable</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {spec.balustradeType === "timber" ? (
                      <div className="space-y-1.5">
                        <Label className="font-bold uppercase text-xs">Timber Gap (mm)</Label>
                        <Input
                          type="number" min="5" max="50" name="timberGapMm"
                          value={spec.timberGapMm} onChange={handleChange}
                          className="font-mono h-9 w-28"
                        />
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        <Label className="font-bold uppercase text-xs">Wire Spacing (mm)</Label>
                        <Input
                          type="number" min="50" max="150" step="10" name="wireSpacingMm"
                          value={spec.wireSpacingMm} onChange={handleChange}
                          className="font-mono h-9 w-28"
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Stairs */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="includeStairs"
                    checked={spec.includeStairs}
                    onCheckedChange={(v) => setBool("includeStairs", !!v)}
                  />
                  <Label htmlFor="includeStairs" className="font-bold cursor-pointer">Stairs</Label>
                </div>
                {spec.includeStairs && (
                  <div className="pl-7 space-y-1.5">
                    <Label className="font-bold uppercase text-xs">Flights</Label>
                    <Input
                      type="number" min="1" max="4" name="stairFlights"
                      value={spec.stairFlights} onChange={handleChange}
                      className="font-mono h-9 w-24"
                    />
                  </div>
                )}
              </div>

              {/* Fencing */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="includeFencing"
                    checked={spec.includeFencing}
                    onCheckedChange={(v) => setBool("includeFencing", !!v)}
                  />
                  <Label htmlFor="includeFencing" className="font-bold cursor-pointer">Fencing</Label>
                </div>
                {spec.includeFencing && (
                  <div className="pl-7 space-y-3">
                    <div className="space-y-1.5">
                      <Label className="font-bold uppercase text-xs">Sides with Fencing</Label>
                      <Input
                        type="number" min="1" max="4" name="fencingSides"
                        value={spec.fencingSides} onChange={handleChange}
                        className="font-mono h-9 w-24"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="font-bold uppercase text-xs">Fence Height (m)</Label>
                        <Input
                          type="number" min="0.9" max="2.4" step="0.1" name="fencingHeightM"
                          value={spec.fencingHeightM} onChange={handleChange}
                          className="font-mono h-9"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="font-bold uppercase text-xs">Bay Width (m)</Label>
                        <Input
                          type="number" min="0.9" max="3.0" step="0.1" name="fencingWidthM"
                          value={spec.fencingWidthM} onChange={handleChange}
                          className="font-mono h-9"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Awning */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="includeAwning"
                    checked={spec.includeAwning}
                    onCheckedChange={(v) => setBool("includeAwning", !!v)}
                  />
                  <Label htmlFor="includeAwning" className="font-bold cursor-pointer">Awning (cuts boards)</Label>
                </div>
                {spec.includeAwning && (
                  <div className="pl-7 grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="font-bold uppercase text-xs">Awning Width (m)</Label>
                      <Input type="number" step="0.5" name="awningWidthM" value={spec.awningWidthM} onChange={handleChange} className="font-mono h-9" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="font-bold uppercase text-xs">Awning Length (m)</Label>
                      <Input type="number" step="0.5" name="awningLengthM" value={spec.awningLengthM} onChange={handleChange} className="font-mono h-9" />
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Labour + advanced */}
          <Card className="border-2">
            <button
              onClick={() => setAdvancedOpen(!advancedOpen)}
              className="w-full flex items-center justify-between px-5 py-3 bg-muted/50 border-b hover:bg-muted/80 transition-colors"
            >
              <span className="font-black uppercase text-sm tracking-wider">Labour & Advanced</span>
              {advancedOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            {advancedOpen && (
              <CardContent className="p-5 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="font-bold uppercase text-xs">Labour Hours</Label>
                    <Input type="number" name="labourHours" value={spec.labourHours} onChange={handleChange} className="font-mono h-10" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="font-bold uppercase text-xs">Labour Rate ($/hr)</Label>
                    <Input type="number" name="labourRate" value={spec.labourRate} onChange={handleChange} className="font-mono h-10" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="font-bold uppercase text-xs">Wastage Factor</Label>
                    <Input type="number" step="0.05" name="wastageFactor" value={spec.wastageFactor} onChange={handleChange} className="font-mono h-10" />
                  </div>
                </div>
              </CardContent>
            )}
          </Card>
        </div>

        {/* ── RIGHT: Results ── */}
        <div className="lg:col-span-7 space-y-4">
          {/* Total banner */}
          <Card className="border-2 border-primary/30 overflow-hidden">
            <div className="bg-primary p-6 text-primary-foreground">
              <h2 className="text-xs font-bold uppercase tracking-widest opacity-75 mb-1">
                Estimated Total (inc GST)
              </h2>
              <div className="text-5xl font-black tracking-tighter">
                {estData ? formatCurrency(estData.total) : "$0.00"}
              </div>
            </div>
            <div className="grid grid-cols-3 divide-x divide-border bg-muted/20">
              <div className="p-3 text-center">
                <div className="text-xs font-bold uppercase text-muted-foreground">Materials</div>
                <div className="font-mono font-bold mt-0.5">{formatCurrency(estData?.materialsSubtotal ?? 0)}</div>
              </div>
              <div className="p-3 text-center">
                <div className="text-xs font-bold uppercase text-muted-foreground">Labour</div>
                <div className="font-mono font-bold mt-0.5">{formatCurrency(estData?.labourCost ?? 0)}</div>
              </div>
              <div className="p-3 text-center">
                <div className="text-xs font-bold uppercase text-muted-foreground">GST</div>
                <div className="font-mono font-bold mt-0.5">{formatCurrency(estData?.gst ?? 0)}</div>
              </div>
            </div>
          </Card>

          {/* Supplier totals comparison */}
          {supplierTotals.length >= 2 && (
            <Card className="border-2 border-green-600/30 overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 bg-green-950/30 border-b border-green-600/20">
                <ShoppingCart className="w-4 h-4 text-green-500" />
                <span className="text-xs font-bold uppercase tracking-wider text-green-500">
                  Total Cart Comparison
                </span>
              </div>
              <div className="divide-y divide-border">
                {supplierTotals.map((st, i) => {
                  const isBest = i === 0;
                  const diff = st.total - supplierTotals[0].total;
                  return (
                    <div
                      key={st.supplier}
                      className={`flex items-center gap-4 px-4 py-3 ${isBest ? "bg-green-950/20" : ""}`}
                    >
                      <div
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: isBest ? "#22c55e" : supplierColor(st.supplier) }}
                      />
                      <div className="flex-1">
                        <span className={`font-bold text-sm ${isBest ? "text-green-500" : "text-foreground"}`}>
                          {supplierLabel(st.supplier)}
                        </span>
                        {isBest && (
                          <Badge className="ml-2 bg-green-600 text-white text-xs">CHEAPEST</Badge>
                        )}
                      </div>
                      <div className="text-right">
                        <div className={`font-mono font-black text-lg ${isBest ? "text-green-500" : "text-foreground"}`}>
                          {formatCurrency(st.total)}
                        </div>
                        {!isBest && diff > 0 && (
                          <div className="text-xs text-red-500 font-bold">+{formatCurrency(diff)} more</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              {supplierTotals.length >= 2 && supplierTotals[supplierTotals.length - 1].total - supplierTotals[0].total > 0.5 && (
                <div className="flex items-center gap-2 px-4 py-3 bg-green-950/20 border-t border-green-600/20">
                  <TrendingDown className="w-4 h-4 text-green-500" />
                  <span className="text-sm font-bold text-green-500">
                    Buy from {supplierLabel(supplierTotals[0].supplier)} and save{" "}
                    {formatCurrency(supplierTotals[supplierTotals.length - 1].total - supplierTotals[0].total)} on materials
                  </span>
                </div>
              )}
            </Card>
          )}

          {/* BOM table */}
          {estData && enrichedLines.length > 0 && (
            <Card className="border-2 overflow-hidden">
              <div className="px-4 py-3 bg-muted/30 border-b">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Bill of Materials — {enrichedLines.length} items
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/20">
                      <th className="text-left px-4 py-2 font-bold uppercase text-xs text-muted-foreground">Item</th>
                      <th className="text-right px-3 py-2 font-bold uppercase text-xs text-muted-foreground">Qty</th>
                      {/* Dynamic supplier columns */}
                      {supplierTotals.length >= 2 ? (
                        supplierTotals.map((st) => (
                          <th
                            key={st.supplier}
                            className="text-right px-3 py-2 font-bold uppercase text-xs"
                            style={{ color: supplierColor(st.supplier) }}
                          >
                            {supplierLabel(st.supplier)}
                          </th>
                        ))
                      ) : (
                        <th className="text-right px-4 py-2 font-bold uppercase text-xs text-muted-foreground">Total</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {enrichedLines.map((line, i) => (
                      <tr key={i} className="hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3">
                          <div className="font-medium">{line.description}</div>
                          <div className="text-xs text-muted-foreground capitalize">{line.category}</div>
                        </td>
                        <td className="px-3 py-3 text-right font-mono text-xs text-muted-foreground whitespace-nowrap">
                          {line.quantity} {line.unit}
                        </td>
                        {supplierTotals.length >= 2 ? (
                          supplierTotals.map((st, si) => {
                            const p = line.supplierPrices.find((sp) => sp.supplier === st.supplier);
                            const lineAmt = p ? p.unitPrice * line.quantity : null;
                            const isBest = p && si === 0 && line.supplierPrices.length > 1;
                            return (
                              <td
                                key={st.supplier}
                                className={`px-3 py-3 text-right font-mono text-sm ${isBest ? "text-green-500 font-bold" : "text-muted-foreground"}`}
                              >
                                {lineAmt != null ? formatCurrency(lineAmt) : <span className="text-muted-foreground/40">—</span>}
                              </td>
                            );
                          })
                        ) : (
                          <td className="px-4 py-3 text-right font-mono font-medium">
                            {formatCurrency(line.lineTotal)}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 font-bold bg-muted/20">
                      <td className="px-4 py-3 font-black uppercase text-sm" colSpan={2}>
                        Materials Subtotal
                      </td>
                      {supplierTotals.length >= 2 ? (
                        supplierTotals.map((st, si) => (
                          <td
                            key={st.supplier}
                            className={`px-3 py-3 text-right font-mono font-black ${si === 0 ? "text-green-500" : ""}`}
                          >
                            {formatCurrency(st.total)}
                          </td>
                        ))
                      ) : (
                        <td className="px-4 py-3 text-right font-mono font-black">
                          {formatCurrency(estData.materialsSubtotal)}
                        </td>
                      )}
                    </tr>
                  </tfoot>
                </table>
              </div>
            </Card>
          )}

          {/* Save as Quote */}
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button
                className="w-full h-14 text-lg font-black uppercase rounded-sm"
                disabled={!estData}
              >
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
                  <Input
                    value={quoteTitle}
                    onChange={(e) => setQuoteTitle(e.target.value)}
                    placeholder="E.g. Smith Deck"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="font-bold uppercase text-xs">Customer</Label>
                  <Select value={customerId} onValueChange={setCustomerId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a customer" />
                    </SelectTrigger>
                    <SelectContent>
                      {customers?.map((c) => (
                        <SelectItem key={c.id} value={c.id.toString()}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  className="w-full h-12 font-black uppercase"
                  onClick={handleSaveQuote}
                  disabled={createQuote.isPending}
                >
                  {createQuote.isPending ? (
                    <Loader2 className="animate-spin w-5 h-5" />
                  ) : (
                    "Save & Continue"
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>
  );
}
