import {
  useListReferralSources,
  useCreateReferralSource,
  useListSignUpLeads,
  getListReferralSourcesQueryKey,
  type ReferralSource,
  type SignUpLead,
} from "@workspace/api-client-react";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, QrCode, Users, TrendingUp, ExternalLink, Download } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO } from "date-fns";

const SOURCE_TYPES = ["facebook", "instagram", "tradie_app", "word_of_mouth", "flyer", "website", "other"];

function QrDisplay({ sourceId, code }: { sourceId: number; code: string }) {
  const url = `/api/referrals/sources/${sourceId}/qr`;

  function handleDownload() {
    const a = document.createElement("a");
    a.href = url;
    a.download = `ref-qr-${code}.svg`;
    a.click();
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="border rounded-lg p-3 bg-white w-40 h-40 flex items-center justify-center">
        <img src={url} alt="QR Code" className="w-full h-full" />
      </div>
      <Button variant="outline" size="sm" onClick={handleDownload}>
        <Download className="w-3.5 h-3.5 mr-1.5" /> Download SVG
      </Button>
    </div>
  );
}

export default function ReferralsPage() {
  const { data: sources, isLoading: sourcesLoading } = useListReferralSources();
  const { data: leads, isLoading: leadsLoading } = useListSignUpLeads({});
  const createSource = useCreateReferralSource();
  const qc = useQueryClient();
  const { toast } = useToast();

  const [open, setOpen] = useState(false);
  const [qrSource, setQrSource] = useState<{ id: number; name: string; code: string } | null>(null);
  const [form, setForm] = useState({ code: "", name: "", type: "", description: "" });

  async function handleCreate() {
    if (!form.code || !form.name) {
      toast({ title: "Name and code are required", variant: "destructive" });
      return;
    }
    try {
      await createSource.mutateAsync({
        data: {
          code: form.code,
          name: form.name,
          type: form.type || undefined,
          description: form.description || undefined,
        },
      });
      qc.invalidateQueries({ queryKey: getListReferralSourcesQueryKey() });
      toast({ title: "Referral source created" });
      setOpen(false);
      setForm({ code: "", name: "", type: "", description: "" });
    } catch {
      toast({ title: "Error creating source", variant: "destructive" });
    }
  }

  const totalLeads = (leads ?? []).length;
  const thisMonth = (leads ?? []).filter((l) => {
    try {
      const d = parseISO(l.createdAt as string);
      const now = new Date();
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    } catch { return false; }
  }).length;

  const leadsBySource = (sources ?? []).map((s) => ({
    ...s,
    leadCount: (leads ?? []).filter((l: SignUpLead) => l.referralCode === s.code).length,
  }));

  const topSourceCount = leadsBySource.sort((a, b) => (b.leadCount ?? 0) - (a.leadCount ?? 0))[0]?.leadCount ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-black text-foreground flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-primary" /> REFERRAL TRACKING
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Track where your leads come from</p>
        </div>
        <Button onClick={() => setOpen(true)} className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold">
          <Plus className="w-4 h-4 mr-2" /> NEW SOURCE
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-2xl font-black text-primary">{totalLeads}</p>
            <p className="text-xs text-muted-foreground">Total Leads</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-2xl font-black text-primary">{thisMonth}</p>
            <p className="text-xs text-muted-foreground">This Month</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-2xl font-black text-primary">{(sources ?? []).length}</p>
            <p className="text-xs text-muted-foreground">Active Sources</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-2xl font-black text-primary">{topSourceCount}</p>
            <p className="text-xs text-muted-foreground">Top Source Leads</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="sources">
        <TabsList>
          <TabsTrigger value="sources">Sources &amp; QR Codes</TabsTrigger>
          <TabsTrigger value="leads">Sign-Up Leads</TabsTrigger>
        </TabsList>

        <TabsContent value="sources" className="mt-4">
          {sourcesLoading ? (
            <p className="text-muted-foreground text-sm">Loading...</p>
          ) : (sources ?? []).length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <QrCode className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No referral sources yet</p>
              <p className="text-sm">Create a source to generate a QR code</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {leadsBySource.map((s) => (
                <Card key={s.id} className="border-l-4 border-l-primary">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-bold flex items-center justify-between">
                      <span>{s.name}</span>
                      <Badge variant="default" className="text-xs">
                        {s.leadCount} leads
                      </Badge>
                    </CardTitle>
                    <div className="flex gap-1 flex-wrap">
                      {s.type && <Badge variant="outline" className="text-xs capitalize">{s.type.replace(/_/g, " ")}</Badge>}
                      <Badge variant="outline" className="text-xs font-mono">{s.code}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full text-xs border-primary text-primary hover:bg-primary hover:text-primary-foreground"
                      onClick={() => setQrSource({ id: s.id, name: s.name, code: s.code })}
                    >
                      <QrCode className="w-3.5 h-3.5 mr-1.5" /> View QR Code
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="leads" className="mt-4">
          {leadsLoading ? (
            <p className="text-muted-foreground text-sm">Loading...</p>
          ) : (leads ?? []).length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No leads yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {(leads ?? []).map((l: SignUpLead) => (
                <Card key={l.id} className="border-l-4 border-l-muted-foreground/30">
                  <CardContent className="py-3 px-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-bold text-sm">{l.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {l.email && <span className="mr-3">{l.email}</span>}
                          {l.phone && <span>{l.phone}</span>}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        {l.referralCode && (
                          <Badge variant="outline" className="text-xs font-mono">{l.referralCode}</Badge>
                        )}
                        <p className="text-[10px] text-muted-foreground mt-1">
                          {format(parseISO(l.createdAt as string), "d MMM yy")}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Create source dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New Referral Source</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>Source Name *</Label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Facebook Campaign — May 2026" />
            </div>
            <div className="space-y-1">
              <Label>Referral Code *</Label>
              <Input value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase().replace(/\s/g, "-") }))} placeholder="e.g. FB-MAY-2026" />
              <p className="text-xs text-muted-foreground">Unique code embedded in the QR code URL</p>
            </div>
            <div className="space-y-1">
              <Label>Type</Label>
              <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v }))}>
                <SelectTrigger><SelectValue placeholder="Select type..." /></SelectTrigger>
                <SelectContent>
                  {SOURCE_TYPES.map((t) => <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Description (optional)</Label>
              <Input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="e.g. Flyer drop in Newtown" />
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              className="flex-1 bg-primary hover:bg-primary/90 font-bold"
              onClick={handleCreate}
              disabled={!form.name || !form.code || createSource.isPending}
            >
              Create Source
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* QR Code dialog */}
      <Dialog open={!!qrSource} onOpenChange={() => setQrSource(null)}>
        {qrSource && (
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>QR Code — {qrSource.name}</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col items-center py-4 space-y-3">
              <QrDisplay sourceId={qrSource.id} code={qrSource.code} />
              <p className="text-xs text-muted-foreground text-center">
                Scan to open the sign-up page with code <span className="font-mono font-bold">{qrSource.code}</span>
              </p>
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <ExternalLink className="w-3.5 h-3.5" />
                <span className="font-mono break-all">/sign-up?ref={qrSource.code}</span>
              </div>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
