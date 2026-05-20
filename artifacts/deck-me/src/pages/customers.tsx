import { useListCustomers, useCreateCustomer, useUpdateCustomer, useDeleteCustomer, getListCustomersQueryKey } from "@workspace/api-client-react";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Users, Plus, Phone, Mail, Building, MoreVertical, Edit2, Trash2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import type { Customer } from "@workspace/api-client-react";

export default function Customers() {
  const { data: customers, isLoading } = useListCustomers();
  const createCustomer = useCreateCustomer();
  const updateCustomer = useUpdateCustomer();
  const deleteCustomer = useDeleteCustomer();
  
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ name: "", phone: "", email: "", company: "" });

  const handleOpenCreate = () => {
    setEditingId(null);
    setForm({ name: "", phone: "", email: "", company: "" });
    setOpen(true);
  };

  const handleOpenEdit = (c: Customer) => {
    setEditingId(c.id);
    setForm({ 
      name: c.name, 
      phone: c.phone || "", 
      email: c.email || "", 
      company: c.company || "" 
    });
    setOpen(true);
  };

  const handleSave = () => {
    if (editingId) {
      updateCustomer.mutate({ id: editingId, data: form }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListCustomersQueryKey() });
          setOpen(false);
          toast({ title: "Customer updated" });
        }
      });
    } else {
      createCustomer.mutate({ data: form }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListCustomersQueryKey() });
          setOpen(false);
          toast({ title: "Customer created" });
        }
      });
    }
  };

  const handleDelete = (id: number) => {
    if (confirm("Delete this customer?")) {
      deleteCustomer.mutate({ id }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListCustomersQueryKey() });
          toast({ title: "Customer deleted" });
        }
      });
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tight">Customers</h1>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <Button onClick={handleOpenCreate} className="font-bold uppercase">
            <Plus className="w-4 h-4 mr-2" /> Add Client
          </Button>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-display font-black uppercase text-xl">
                {editingId ? "Edit Client" : "New Client"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <Input placeholder="Name" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
              <Input placeholder="Company" value={form.company} onChange={e => setForm({...form, company: e.target.value})} />
              <Input placeholder="Phone" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} />
              <Input placeholder="Email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} />
              <Button onClick={handleSave} className="w-full font-bold uppercase" disabled={!form.name || createCustomer.isPending || updateCustomer.isPending}>
                Save
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3].map(i => <div key={i} className="h-40 bg-muted animate-pulse rounded-lg" />)}
        </div>
      ) : customers?.length === 0 ? (
        <div className="text-center py-20 border-2 border-dashed rounded-lg">
          <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-xl font-bold uppercase mb-2">No Customers</h2>
          <p className="text-muted-foreground mb-6">Add your first client to start quoting.</p>
          <Button onClick={handleOpenCreate} className="font-bold uppercase"><Plus className="w-4 h-4 mr-2"/> Add Client</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {customers?.map(c => (
            <Card key={c.id} className="border-2 shadow-sm relative group">
              <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="w-4 h-4" /></Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleOpenEdit(c)}><Edit2 className="w-4 h-4 mr-2" /> Edit</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleDelete(c.id)} className="text-destructive"><Trash2 className="w-4 h-4 mr-2" /> Delete</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <CardContent className="p-6">
                <h3 className="text-xl font-black mb-1 pr-8">{c.name}</h3>
                {c.company && <div className="text-sm font-bold text-muted-foreground flex items-center gap-2 mb-3"><Building className="w-4 h-4" /> {c.company}</div>}
                
                <div className="space-y-2 mt-4 pt-4 border-t border-border">
                  {c.phone && <div className="text-sm flex items-center gap-2"><Phone className="w-4 h-4 text-primary" /> {c.phone}</div>}
                  {c.email && <div className="text-sm flex items-center gap-2"><Mail className="w-4 h-4 text-primary" /> {c.email}</div>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
