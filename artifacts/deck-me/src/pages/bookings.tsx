import { useListBookings, useCreateBooking, useUpdateBooking, useDeleteBooking, getListBookingsQueryKey, useListCustomers } from "@workspace/api-client-react";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Calendar as CalIcon, MapPin, Plus, MoreVertical, Edit2, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Booking } from "@workspace/api-client-react";

export default function Bookings() {
  const { data: bookings, isLoading } = useListBookings();
  const { data: customers } = useListCustomers();
  const createBooking = useCreateBooking();
  const updateBooking = useUpdateBooking();
  const deleteBooking = useDeleteBooking();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  
  // Format for datetime-local input
  const getToday = () => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  };

  const [form, setForm] = useState({
    title: "",
    customerId: "",
    siteAddress: "",
    startAt: getToday(),
    endAt: getToday(),
    status: "scheduled"
  });

  const handleOpenCreate = () => {
    setEditingId(null);
    setForm({
      title: "", customerId: "", siteAddress: "", startAt: getToday(), endAt: getToday(), status: "scheduled"
    });
    setOpen(true);
  };

  const handleOpenEdit = (b: Booking) => {
    setEditingId(b.id);
    const start = new Date(b.startAt);
    start.setMinutes(start.getMinutes() - start.getTimezoneOffset());
    const end = new Date(b.endAt);
    end.setMinutes(end.getMinutes() - end.getTimezoneOffset());
    
    setForm({
      title: b.title,
      customerId: b.customerId?.toString() || "",
      siteAddress: b.siteAddress || "",
      startAt: start.toISOString().slice(0, 16),
      endAt: end.toISOString().slice(0, 16),
      status: b.status
    });
    setOpen(true);
  };

  const handleSave = () => {
    const payload = {
      ...form,
      customerId: form.customerId ? parseInt(form.customerId) : undefined,
      startAt: new Date(form.startAt).toISOString(),
      endAt: new Date(form.endAt).toISOString(),
    };
    
    if (editingId) {
      updateBooking.mutate({ id: editingId, data: payload }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListBookingsQueryKey() });
          setOpen(false);
          toast({ title: "Booking updated" });
        }
      });
    } else {
      createBooking.mutate({ data: payload }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListBookingsQueryKey() });
          setOpen(false);
          toast({ title: "Booking created" });
        }
      });
    }
  };

  const handleDelete = (id: number) => {
    if (confirm("Delete this booking?")) {
      deleteBooking.mutate({ id }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListBookingsQueryKey() });
          toast({ title: "Booking deleted" });
        }
      });
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tight">Schedule</h1>
          <p className="text-muted-foreground font-medium">Upcoming jobs</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <Button onClick={handleOpenCreate} className="font-bold uppercase">
            <Plus className="w-4 h-4 mr-2" /> Book Job
          </Button>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-display font-black uppercase text-xl">
                {editingId ? "Edit Booking" : "New Booking"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Title</Label>
                <Input placeholder="E.g. Deck Build" value={form.title} onChange={e => setForm({...form, title: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Customer</Label>
                <Select value={form.customerId} onValueChange={v => setForm({...form, customerId: v})}>
                  <SelectTrigger><SelectValue placeholder="Select Customer" /></SelectTrigger>
                  <SelectContent>
                    {customers?.map(c => <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Start Date/Time</Label>
                  <Input type="datetime-local" value={form.startAt} onChange={e => setForm({...form, startAt: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label>End Date/Time</Label>
                  <Input type="datetime-local" value={form.endAt} onChange={e => setForm({...form, endAt: e.target.value})} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Site Address</Label>
                <Input value={form.siteAddress} onChange={e => setForm({...form, siteAddress: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={v => setForm({...form, status: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="scheduled">Scheduled</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleSave} className="w-full font-bold uppercase mt-4" disabled={!form.title || createBooking.isPending || updateBooking.isPending}>
                Save Booking
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-4">
        {isLoading ? (
          [1,2,3].map(i => <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />)
        ) : bookings?.length === 0 ? (
          <div className="text-center py-20 border-2 border-dashed rounded-lg">
             <CalIcon className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
             <h2 className="text-xl font-bold uppercase mb-2">No Jobs Scheduled</h2>
             <Button onClick={handleOpenCreate} className="font-bold uppercase"><Plus className="w-4 h-4 mr-2"/> Book a Job</Button>
          </div>
        ) : (
          bookings?.map(b => (
            <Card key={b.id} className="border-2 shadow-sm flex overflow-hidden group">
              <div className="bg-primary text-primary-foreground p-4 flex flex-col justify-center items-center min-w-[100px] text-center border-r border-primary-foreground/10">
                <div className="text-sm font-bold uppercase">{format(new Date(b.startAt), 'MMM')}</div>
                <div className="text-3xl font-black leading-none">{format(new Date(b.startAt), 'dd')}</div>
              </div>
              <CardContent className="p-4 md:p-6 flex-1 flex flex-col md:flex-row justify-between gap-4">
                <div>
                  <h3 className="text-xl font-black">{b.title}</h3>
                  <div className="text-muted-foreground font-medium mt-1">{b.customerName}</div>
                  {b.siteAddress && (
                    <div className="flex items-center gap-1 text-sm mt-2 text-muted-foreground">
                      <MapPin className="w-4 h-4" /> {b.siteAddress}
                    </div>
                  )}
                </div>
                <div className="flex items-start md:items-center gap-4 md:flex-col justify-between">
                  <div className="text-xs font-bold uppercase px-3 py-1 bg-muted rounded-sm">
                    {b.status}
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="md:opacity-0 group-hover:opacity-100"><MoreVertical className="w-4 h-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleOpenEdit(b)}><Edit2 className="w-4 h-4 mr-2" /> Edit</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDelete(b.id)} className="text-destructive"><Trash2 className="w-4 h-4 mr-2" /> Delete</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
