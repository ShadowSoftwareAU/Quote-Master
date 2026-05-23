import {
  useListPortfolioEntries,
  useCreatePortfolioEntry,
  useUpdatePortfolioEntry,
  useDeletePortfolioEntry,
  getListPortfolioEntriesQueryKey,
  type PortfolioEntry,
} from "@workspace/api-client-react";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Edit2, Trash2, Star, Images, Globe, Lock } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

const DECK_TYPES = ["Hardwood", "Softwood", "Composite", "Treated Pine", "Merbau", "Spotted Gum", "Other"];

const EMPTY_FORM = {
  title: "",
  description: "",
  deckType: "",
  customerName: "",
  testimonial: "",
  rating: "",
  completedAt: "",
  isPublic: true,
};

function getPublicUrl(objectPath: string) {
  return `/api/storage/objects/${objectPath}`;
}

export default function PortfolioPage() {
  const { data: entries, isLoading } = useListPortfolioEntries();
  const createEntry = useCreatePortfolioEntry();
  const updateEntry = useUpdatePortfolioEntry();
  const deleteEntry = useDeletePortfolioEntry();
  const qc = useQueryClient();
  const { toast } = useToast();

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [filterType, setFilterType] = useState<string>("all");
  const [viewEntry, setViewEntry] = useState<PortfolioEntry | null>(null);

  function openAdd() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setOpen(true);
  }

  function openEdit(e: PortfolioEntry) {
    setEditingId(e.id);
    setForm({
      title: e.title,
      description: e.description ?? "",
      deckType: e.deckType ?? "",
      customerName: e.customerName ?? "",
      testimonial: e.testimonial ?? "",
      rating: e.rating?.toString() ?? "",
      completedAt: e.completedAt ? e.completedAt.slice(0, 10) : "",
      isPublic: e.isPublic,
    });
    setOpen(true);
  }

  async function handleSave() {
    const payload = {
      title: form.title,
      description: form.description || undefined,
      deckType: form.deckType || undefined,
      customerName: form.customerName || undefined,
      testimonial: form.testimonial || undefined,
      rating: form.rating ? parseInt(form.rating) : undefined,
      completedAt: form.completedAt || undefined,
      isPublic: form.isPublic,
    };
    try {
      if (editingId) {
        await updateEntry.mutateAsync({ id: editingId, data: payload });
        toast({ title: "Portfolio entry updated" });
      } else {
        await createEntry.mutateAsync({ data: payload });
        toast({ title: "Portfolio entry created" });
      }
      qc.invalidateQueries({ queryKey: getListPortfolioEntriesQueryKey() });
      setOpen(false);
    } catch {
      toast({ title: "Error saving entry", variant: "destructive" });
    }
  }

  async function handleDelete(id: number) {
    try {
      await deleteEntry.mutateAsync({ id });
      qc.invalidateQueries({ queryKey: getListPortfolioEntriesQueryKey() });
      toast({ title: "Entry deleted" });
    } catch {
      toast({ title: "Error deleting entry", variant: "destructive" });
    }
  }

  const filtered = (entries ?? []).filter((e) => {
    if (filterType === "all") return true;
    if (filterType === "public") return e.isPublic;
    return e.deckType === filterType;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-black text-foreground flex items-center gap-2">
            <Images className="w-6 h-6 text-primary" /> COMPLETED JOBS
          </h1>
          <p className="text-muted-foreground text-sm mt-1">{(entries ?? []).length} portfolio entries</p>
        </div>
        <Button onClick={openAdd} className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold">
          <Plus className="w-4 h-4 mr-2" /> ADD ENTRY
        </Button>
      </div>

      <div className="flex gap-2 flex-wrap">
        {["all", "public", ...DECK_TYPES].map((t) => (
          <Button
            key={t}
            variant={filterType === t ? "default" : "outline"}
            size="sm"
            className={filterType === t ? "bg-primary text-primary-foreground" : ""}
            onClick={() => setFilterType(t)}
          >
            {t === "all" ? "All" : t === "public" ? "🌐 Public" : t}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <div className="text-muted-foreground text-sm">Loading portfolio...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Images className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No entries yet</p>
          <p className="text-sm">Add your first completed job to the gallery</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((e) => (
            <Card key={e.id} className="overflow-hidden cursor-pointer group" onClick={() => setViewEntry(e)}>
              <div className="h-40 bg-muted relative overflow-hidden">
                {e.afterPhotos.length > 0 ? (
                  <img
                    src={getPublicUrl(e.afterPhotos[0])}
                    alt={e.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : e.beforePhotos.length > 0 ? (
                  <img
                    src={getPublicUrl(e.beforePhotos[0])}
                    alt={e.title}
                    className="w-full h-full object-cover opacity-60"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground/30">
                    <Images className="w-12 h-12" />
                  </div>
                )}
                {e.isPublic ? (
                  <span className="absolute top-2 right-2 bg-green-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5">
                    <Globe className="w-2.5 h-2.5" /> PUBLIC
                  </span>
                ) : (
                  <span className="absolute top-2 right-2 bg-muted text-muted-foreground text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5">
                    <Lock className="w-2.5 h-2.5" /> PRIVATE
                  </span>
                )}
                {e.afterPhotos.length > 0 && e.beforePhotos.length > 0 && (
                  <span className="absolute bottom-2 left-2 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded">
                    BEFORE &amp; AFTER
                  </span>
                )}
              </div>
              <CardHeader className="pb-1 pt-3">
                <CardTitle className="text-sm font-bold line-clamp-1">{e.title}</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 pb-3 space-y-1">
                <div className="flex gap-1.5 flex-wrap">
                  {e.deckType && <Badge variant="secondary" className="text-xs">{e.deckType}</Badge>}
                  {e.customerName && (
                    <span className="text-xs text-muted-foreground">{e.customerName}</span>
                  )}
                </div>
                {e.rating && (
                  <div className="flex gap-0.5">
                    {Array.from({ length: 5 }, (_, i) => (
                      <Star key={i} className={`w-3.5 h-3.5 ${i < e.rating! ? "text-yellow-500 fill-yellow-500" : "text-muted-foreground"}`} />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Entry detail view */}
      <Dialog open={!!viewEntry} onOpenChange={() => setViewEntry(null)}>
        {viewEntry && (
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center justify-between pr-8">
                <span>{viewEntry.title}</span>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); openEdit(viewEntry); setViewEntry(null); }}>
                    <Edit2 className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => { handleDelete(viewEntry.id); setViewEntry(null); }}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex gap-2 flex-wrap text-sm text-muted-foreground">
                {viewEntry.deckType && <Badge variant="secondary">{viewEntry.deckType}</Badge>}
                {viewEntry.customerName && <span>{viewEntry.customerName}</span>}
                {viewEntry.completedAt && <span>Completed: {viewEntry.completedAt.slice(0, 10)}</span>}
              </div>
              {viewEntry.description && <p className="text-sm">{viewEntry.description}</p>}
              {viewEntry.testimonial && (
                <blockquote className="border-l-2 border-primary pl-3 italic text-sm text-muted-foreground">
                  "{viewEntry.testimonial}"
                </blockquote>
              )}

              {viewEntry.beforePhotos.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-muted-foreground uppercase mb-2">Before</p>
                  <div className="grid grid-cols-3 gap-2">
                    {viewEntry.beforePhotos.map((p) => (
                      <img key={p} src={getPublicUrl(p)} alt="before" className="w-full h-24 object-cover rounded" />
                    ))}
                  </div>
                </div>
              )}
              {viewEntry.afterPhotos.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-muted-foreground uppercase mb-2">After</p>
                  <div className="grid grid-cols-3 gap-2">
                    {viewEntry.afterPhotos.map((p) => (
                      <img key={p} src={getPublicUrl(p)} alt="after" className="w-full h-24 object-cover rounded" />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </DialogContent>
        )}
      </Dialog>

      {/* Add / Edit dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Entry" : "New Portfolio Entry"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>Title *</Label>
              <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="e.g. Merbau Deck — Paddington" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Deck Type</Label>
                <Select value={form.deckType} onValueChange={(v) => setForm((f) => ({ ...f, deckType: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent>
                    {DECK_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Customer Name</Label>
                <Input value={form.customerName} onChange={(e) => setForm((f) => ({ ...f, customerName: e.target.value }))} placeholder="e.g. Smith Family" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Rating (1–5)</Label>
                <Input type="number" min={1} max={5} value={form.rating} onChange={(e) => setForm((f) => ({ ...f, rating: e.target.value }))} placeholder="5" />
              </div>
              <div className="space-y-1">
                <Label>Completed Date</Label>
                <Input type="date" value={form.completedAt} onChange={(e) => setForm((f) => ({ ...f, completedAt: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Description</Label>
              <Textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Brief description of the job..." rows={2} />
            </div>
            <div className="space-y-1">
              <Label>Customer Testimonial</Label>
              <Textarea value={form.testimonial} onChange={(e) => setForm((f) => ({ ...f, testimonial: e.target.value }))} placeholder="Optional quote from the customer..." rows={2} />
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="isPublic" checked={form.isPublic} onChange={(e) => setForm((f) => ({ ...f, isPublic: e.target.checked }))} className="w-4 h-4 accent-primary" />
              <Label htmlFor="isPublic">Show publicly on website</Label>
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              className="flex-1 bg-primary hover:bg-primary/90 font-bold"
              onClick={handleSave}
              disabled={!form.title || createEntry.isPending || updateEntry.isPending}
            >
              {editingId ? "Save Changes" : "Create Entry"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
