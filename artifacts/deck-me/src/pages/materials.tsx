import { useListMaterials, useCreateMaterial, useUpdateMaterial, useDeleteMaterial, getListMaterialsQueryKey } from "@workspace/api-client-react";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { formatCurrency } from "@/lib/format";
import { Box, Plus, MoreVertical, Edit2, Trash2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import type { Material } from "@workspace/api-client-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

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
    name: "",
    sku: "",
    category: "decking",
    unit: "metre",
    unitPrice: 0,
    packSize: 1,
    supplier: "bunnings",
    notes: ""
  });

  const handleOpenCreate = () => {
    setEditingId(null);
    setForm({
      name: "", sku: "", category: "decking", unit: "metre", unitPrice: 0, packSize: 1, supplier: "bunnings", notes: ""
    });
    setOpen(true);
  };

  const handleOpenEdit = (m: Material) => {
    setEditingId(m.id);
    setForm({
      name: m.name,
      sku: m.sku || "",
      category: m.category,
      unit: m.unit,
      unitPrice: m.unitPrice,
      packSize: m.packSize || 1,
      supplier: m.supplier,
      notes: m.notes || ""
    });
    setOpen(true);
  };

  const handleSave = () => {
    if (editingId) {
      updateMaterial.mutate({ id: editingId, data: form }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListMaterialsQueryKey() });
          setOpen(false);
          toast({ title: "Material updated" });
        }
      });
    } else {
      createMaterial.mutate({ data: form }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListMaterialsQueryKey() });
          setOpen(false);
          toast({ title: "Material created" });
        }
      });
    }
  };

  const handleDelete = (id: number) => {
    if (confirm("Delete this material?")) {
      deleteMaterial.mutate({ id }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListMaterialsQueryKey() });
          toast({ title: "Material deleted" });
        }
      });
    }
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
          <p className="text-muted-foreground font-medium">Catalogue pricing</p>
        </div>
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
                <Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={form.category} onValueChange={v => setForm({...form, category: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="decking">Decking</SelectItem>
                    <SelectItem value="joist">Joist</SelectItem>
                    <SelectItem value="bearer">Bearer</SelectItem>
                    <SelectItem value="post">Post</SelectItem>
                    <SelectItem value="screw">Screw</SelectItem>
                    <SelectItem value="bracket">Bracket</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Unit</Label>
                <Select value={form.unit} onValueChange={v => setForm({...form, unit: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="metre">Metre</SelectItem>
                    <SelectItem value="each">Each</SelectItem>
                    <SelectItem value="pack">Pack</SelectItem>
                    <SelectItem value="bag">Bag</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Unit Price (AUD)</Label>
                <Input type="number" step="0.01" value={form.unitPrice} onChange={e => setForm({...form, unitPrice: parseFloat(e.target.value) || 0})} />
              </div>
              <div className="space-y-2">
                <Label>Supplier</Label>
                <Select value={form.supplier} onValueChange={v => setForm({...form, supplier: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bunnings">Bunnings</SelectItem>
                    <SelectItem value="mitre10">Mitre 10</SelectItem>
                    <SelectItem value="local">Local Timber Yard</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
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

      {isLoading ? (
        <div className="space-y-4">
          <div className="h-64 bg-muted animate-pulse rounded-lg" />
        </div>
      ) : !materials?.length ? (
        <div className="text-center py-20 border-2 border-dashed rounded-lg">
          <Box className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-xl font-bold uppercase mb-2">No Materials</h2>
          <p className="text-muted-foreground mb-6">Build your catalogue to generate quotes.</p>
          <Button onClick={handleOpenCreate} className="font-bold uppercase"><Plus className="w-4 h-4 mr-2"/> Add Material</Button>
        </div>
      ) : (
        <div className="space-y-8">
          {grouped && Object.entries(grouped).map(([category, items]) => (
            <Card key={category} className="border-2 shadow-sm overflow-hidden">
              <CardHeader className="bg-muted/50 border-b">
                <CardTitle className="font-display font-black uppercase text-lg">{category}</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y">
                  {items.map(m => (
                    <div key={m.id} className="p-4 flex justify-between items-center hover:bg-muted/20 group">
                      <div>
                        <div className="font-bold">{m.name}</div>
                        <div className="text-xs text-muted-foreground font-medium uppercase mt-1">
                          {m.supplier} {m.sku && `• ${m.sku}`}
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <div className="font-mono font-black text-lg">{formatCurrency(m.unitPrice)}</div>
                          <div className="text-xs text-muted-foreground">per {m.unit}</div>
                        </div>
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
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
