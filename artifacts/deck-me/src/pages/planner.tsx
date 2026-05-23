import { useListBookings, useListTeamMembers, useUpdateBooking, getListBookingsQueryKey } from "@workspace/api-client-react";
import { useState, useRef, DragEvent } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, CalendarDays, MapPin, Clock } from "lucide-react";
import { addDays, startOfWeek, format, isSameDay, parseISO } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

const STATUS_COLORS: Record<string, string> = {
  scheduled: "bg-blue-500/20 border-blue-500 text-blue-700",
  "in-progress": "bg-primary/20 border-primary text-primary",
  completed: "bg-green-500/20 border-green-500 text-green-700",
  cancelled: "bg-muted border-muted-foreground/30 text-muted-foreground line-through",
};

export default function PlannerPage() {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [dragId, setDragId] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);

  const { data: bookings } = useListBookings();
  const { data: members } = useListTeamMembers();
  const updateBooking = useUpdateBooking();
  const qc = useQueryClient();
  const { toast } = useToast();

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  function bookingsForDay(day: Date) {
    return (bookings ?? []).filter((b) => {
      try { return isSameDay(parseISO(b.startAt as string), day); } catch { return false; }
    });
  }

  function handleDragStart(e: DragEvent, id: number) {
    setDragId(id);
    e.dataTransfer.effectAllowed = "move";
  }

  function handleDragOver(e: DragEvent, dateStr: string) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOver(dateStr);
  }

  async function handleDrop(e: DragEvent, day: Date) {
    e.preventDefault();
    setDragOver(null);
    if (dragId === null) return;
    const booking = (bookings ?? []).find((b) => b.id === dragId);
    if (!booking) return;

    const origStart = new Date(booking.startAt as string);
    const origEnd = new Date(booking.endAt as string);
    const duration = origEnd.getTime() - origStart.getTime();

    const newStart = new Date(day);
    newStart.setHours(origStart.getHours(), origStart.getMinutes(), 0, 0);
    const newEnd = new Date(newStart.getTime() + duration);

    try {
      await updateBooking.mutateAsync({
        id: dragId,
        data: { startAt: newStart.toISOString(), endAt: newEnd.toISOString() },
      });
      qc.invalidateQueries({ queryKey: getListBookingsQueryKey() });
      toast({ title: "Job rescheduled" });
    } catch {
      toast({ title: "Failed to reschedule", variant: "destructive" });
    }
    setDragId(null);
  }

  const today = new Date();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-black text-foreground flex items-center gap-2">
            <CalendarDays className="w-6 h-6 text-primary" /> WEEKLY PLANNER
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {format(weekStart, "d MMM")} — {format(addDays(weekStart, 6), "d MMM yyyy")}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={() => setWeekStart((w) => addDays(w, -7))}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}>
            This Week
          </Button>
          <Button variant="outline" size="icon" onClick={() => setWeekStart((w) => addDays(w, 7))}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-2 min-h-[60vh]">
        {days.map((day) => {
          const dateStr = format(day, "yyyy-MM-dd");
          const isToday = isSameDay(day, today);
          const dayBookings = bookingsForDay(day);
          const isDragTarget = dragOver === dateStr;

          return (
            <div
              key={dateStr}
              className={`flex flex-col rounded-lg border transition-colors ${
                isToday ? "border-primary bg-primary/5" : "border-border bg-card"
              } ${isDragTarget ? "ring-2 ring-primary ring-offset-1" : ""}`}
              onDragOver={(e) => handleDragOver(e, dateStr)}
              onDragLeave={() => setDragOver(null)}
              onDrop={(e) => handleDrop(e, day)}
            >
              <div className={`px-2 py-1.5 border-b text-center ${isToday ? "border-primary/30" : "border-border"}`}>
                <p className="text-[10px] font-bold text-muted-foreground uppercase">{format(day, "EEE")}</p>
                <p className={`text-lg font-black ${isToday ? "text-primary" : "text-foreground"}`}>{format(day, "d")}</p>
              </div>
              <div className="flex-1 p-1.5 space-y-1.5 overflow-y-auto">
                {dayBookings.map((b) => (
                  <div
                    key={b.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, b.id)}
                    className={`rounded border px-1.5 py-1 cursor-grab active:cursor-grabbing text-xs select-none ${
                      STATUS_COLORS[b.status] ?? STATUS_COLORS.scheduled
                    } ${dragId === b.id ? "opacity-40" : ""}`}
                  >
                    <p className="font-bold truncate leading-tight">{b.title}</p>
                    {b.siteAddress && (
                      <p className="flex items-center gap-0.5 text-[10px] opacity-75 truncate mt-0.5">
                        <MapPin className="w-2.5 h-2.5 flex-shrink-0" />
                        {b.siteAddress}
                      </p>
                    )}
                    <p className="flex items-center gap-0.5 text-[10px] opacity-75 mt-0.5">
                      <Clock className="w-2.5 h-2.5 flex-shrink-0" />
                      {format(parseISO(b.startAt as string), "h:mm a")}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        {Object.entries(STATUS_COLORS).map(([s, cls]) => (
          <span key={s} className="flex items-center gap-1">
            <span className={`w-3 h-3 rounded border ${cls}`} />
            {s}
          </span>
        ))}
        <span className="ml-auto italic">Drag jobs between days to reschedule</span>
      </div>
    </div>
  );
}
