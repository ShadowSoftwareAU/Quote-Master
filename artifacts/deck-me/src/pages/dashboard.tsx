import { useGetDashboardSummary } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";
import { Hammer, FileText, CheckCircle, Calendar, Users } from "lucide-react";
import { Link } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";

export default function Dashboard() {
  const { data, isLoading } = useGetDashboardSummary();

  if (isLoading || !data) {
    return (
      <div className="space-y-8">
        <h1 className="text-4xl font-black uppercase text-foreground">G'day</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-32 rounded-lg" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tight text-foreground">G'day</h1>
          <p className="text-muted-foreground mt-2 font-medium">Here's how the jobs are lookin'.</p>
        </div>
        <Link href="/calculator" className="hidden md:flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-md font-bold hover:bg-primary/90 transition-colors uppercase">
          <Hammer className="w-5 h-5" />
          New Quote
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-2 border-primary/20 shadow-sm bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-bold uppercase text-muted-foreground">Total Pipeline</CardTitle>
            <FileText className="w-5 h-5 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-foreground">{formatCurrency(data.totalQuoteValue)}</div>
          </CardContent>
        </Card>
        
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-bold uppercase text-muted-foreground">Active Quotes</CardTitle>
            <FileText className="w-5 h-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-foreground">{data.activeQuoteCount}</div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-bold uppercase text-muted-foreground">Accepted Quotes</CardTitle>
            <CheckCircle className="w-5 h-5 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-foreground">{data.acceptedQuoteCount}</div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-bold uppercase text-muted-foreground">Upcoming Jobs</CardTitle>
            <Calendar className="w-5 h-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-foreground">{data.upcomingBookingCount}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card className="shadow-sm border-2">
          <CardHeader>
            <CardTitle className="font-display font-black uppercase text-xl">Recent Quotes</CardTitle>
          </CardHeader>
          <CardContent>
            {data.recentQuotes.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>No quotes yet.</p>
                <Link href="/calculator" className="text-primary font-bold hover:underline mt-2 inline-block">Quote up a job</Link>
              </div>
            ) : (
              <div className="space-y-4">
                {data.recentQuotes.map(q => (
                  <Link key={q.id} href={`/quotes/${q.id}`} className="flex items-center justify-between p-4 bg-muted/30 rounded-lg hover:bg-muted transition-colors border">
                    <div>
                      <div className="font-bold text-foreground">{q.title}</div>
                      <div className="text-sm text-muted-foreground">{q.customerName || 'No customer'}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-black text-lg text-primary">{formatCurrency(q.total)}</div>
                      <div className="text-xs font-bold uppercase text-muted-foreground">{q.status}</div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm border-2">
          <CardHeader>
            <CardTitle className="font-display font-black uppercase text-xl">Upcoming Bookings</CardTitle>
          </CardHeader>
          <CardContent>
            {data.upcomingBookings.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>No jobs booked in.</p>
                <Link href="/bookings" className="text-primary font-bold hover:underline mt-2 inline-block">Manage bookings</Link>
              </div>
            ) : (
              <div className="space-y-4">
                {data.upcomingBookings.map(b => (
                  <div key={b.id} className="flex items-center justify-between p-4 bg-muted/30 rounded-lg border">
                    <div>
                      <div className="font-bold text-foreground">{b.title}</div>
                      <div className="text-sm text-muted-foreground">{new Date(b.startAt).toLocaleDateString()}</div>
                    </div>
                    <div className="text-xs font-bold uppercase px-2 py-1 bg-primary/10 text-primary rounded">
                      {b.status}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
