import {
  useListTeamMembers,
  useCreateTeamMember,
  useUpdateTeamMember,
  useDeleteTeamMember,
  getListTeamMembersQueryKey,
  type TeamMember,
} from "@workspace/api-client-react";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Plus, MoreVertical, Edit2, UserX, Phone, Mail, Users } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

const EMPTY_FORM = { name: "", role: "", phone: "", email: "", pin: "", linkedClerkUserId: "" };

export default function TeamPage() {
  const { data: members, isLoading } = useListTeamMembers();
  const createMember = useCreateTeamMember();
  const updateMember = useUpdateTeamMember();
  const deleteMember = useDeleteTeamMember();
  const qc = useQueryClient();
  const { toast } = useToast();

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  function openAdd() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setOpen(true);
  }

  function openEdit(m: TeamMember) {
    setEditingId(m.id);
    setForm({
      name: m.name,
      role: m.role ?? "",
      phone: m.phone ?? "",
      email: m.email ?? "",
      pin: "",
      linkedClerkUserId: m.linkedClerkUserId ?? "",
    });
    setOpen(true);
  }

  async function handleSave() {
    const payload = {
      name: form.name,
      role: form.role || undefined,
      phone: form.phone || undefined,
      email: form.email || undefined,
      pin: form.pin || undefined,
      linkedClerkUserId: form.linkedClerkUserId || undefined,
    };
    try {
      if (editingId) {
        await updateMember.mutateAsync({ id: editingId, data: { ...payload, linkedClerkUserId: form.linkedClerkUserId || null } });
        toast({ title: "Team member updated" });
      } else {
        await createMember.mutateAsync({ data: payload });
        toast({ title: "Team member added" });
      }
      qc.invalidateQueries({ queryKey: getListTeamMembersQueryKey() });
      setOpen(false);
    } catch {
      toast({ title: "Error saving team member", variant: "destructive" });
    }
  }

  async function handleDeactivate(id: number) {
    try {
      await deleteMember.mutateAsync({ id });
      qc.invalidateQueries({ queryKey: getListTeamMembersQueryKey() });
      toast({ title: "Team member deactivated" });
    } catch {
      toast({ title: "Error deactivating member", variant: "destructive" });
    }
  }

  const active = (members ?? []).filter((m) => m.active);
  const inactive = (members ?? []).filter((m) => !m.active);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-black text-foreground flex items-center gap-2">
            <Users className="w-6 h-6 text-primary" /> TEAM
          </h1>
          <p className="text-muted-foreground text-sm mt-1">{active.length} active crew members</p>
        </div>
        <Button onClick={openAdd} className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold">
          <Plus className="w-4 h-4 mr-2" /> ADD MEMBER
        </Button>
      </div>

      {isLoading ? (
        <div className="text-muted-foreground text-sm">Loading team...</div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {active.map((m) => (
            <Card key={m.id} className="border-l-4 border-l-primary">
              <CardHeader className="pb-2 flex flex-row items-start justify-between space-y-0">
                <div>
                  <CardTitle className="text-base font-bold">{m.name}</CardTitle>
                  {m.role && <Badge variant="secondary" className="mt-1 text-xs capitalize">{m.role}</Badge>}
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreVertical className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => openEdit(m)}>
                      <Edit2 className="w-4 h-4 mr-2" /> Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={() => handleDeactivate(m.id)}
                    >
                      <UserX className="w-4 h-4 mr-2" /> Deactivate
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </CardHeader>
              <CardContent className="space-y-1 text-sm text-muted-foreground">
                {m.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5" /> {m.phone}
                  </div>
                )}
                {m.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5" /> {m.email}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
          {active.length === 0 && (
            <div className="col-span-full text-center py-16 text-muted-foreground">
              <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No team members yet</p>
              <p className="text-sm">Add your first crew member to get started</p>
            </div>
          )}
        </div>
      )}

      {inactive.length > 0 && (
        <div>
          <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide mb-2">Deactivated</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {inactive.map((m) => (
              <Card key={m.id} className="opacity-50 border-dashed">
                <CardHeader className="pb-1">
                  <CardTitle className="text-sm text-muted-foreground line-through">{m.name}</CardTitle>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Team Member" : "Add Team Member"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>Name *</Label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Full name" />
            </div>
            <div className="space-y-1">
              <Label>Role / Trade</Label>
              <Input value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))} placeholder="e.g. Decking Labourer" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Phone</Label>
                <Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="0400 000 000" />
              </div>
              <div className="space-y-1">
                <Label>Mobile PIN</Label>
                <Input value={form.pin} onChange={(e) => setForm((f) => ({ ...f, pin: e.target.value }))} placeholder="4–6 digit PIN" maxLength={6} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Email</Label>
              <Input value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="email@example.com" type="email" />
            </div>
            <div className="space-y-1">
              <Label>Linked Subcontractor Clerk user ID</Label>
              <Input value={form.linkedClerkUserId} onChange={(e) => setForm((f) => ({ ...f, linkedClerkUserId: e.target.value.trim() }))} placeholder="user_..." />
              <p className="text-xs text-muted-foreground">This explicit link controls which assigned quotes and jobs the Subcontractor can access.</p>
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              className="flex-1 bg-primary hover:bg-primary/90 font-bold"
              onClick={handleSave}
              disabled={!form.name || createMember.isPending || updateMember.isPending}
            >
              {editingId ? "Save Changes" : "Add Member"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
