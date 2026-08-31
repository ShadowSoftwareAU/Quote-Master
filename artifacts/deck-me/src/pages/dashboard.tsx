import { getGetAnalyticsOverviewQueryKey, useGetAnalyticsOverview, useGetDashboardSummary } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";
import { Hammer, FileText, CheckCircle, Calendar, TrendingUp, UserCog, DollarSign, Target, BriefcaseBusiness } from "lucide-react";
import { Link } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { useProfileAccess } from "@/lib/access";

export default function Dashboard() {
  const { data, isLoading } = useGetDashboardSummary();
  const { canViewFinancials } = useProfileAccess();
  const { data: overview, isLoading: isOverviewLoading, isError: isOverviewError } = useGetAnalyticsOverview({
    query: {
      enabled: canViewFinancials,
      retry: 1,
      queryKey: getGetAnalyticsOverviewQueryKey(),
    },
  });

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

  const grossProfit = (data as any).grossProfit ?? 0;
  const totalTradeCost = (data as any).totalTradeCost ?? 0;
  const margin = grossProfit + totalTradeCost > 0
    ? Math.round((grossProfit / (grossProfit + totalTradeCost)) * 100)
    : null;

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tight text-foreground">G'day</h1>
          <p className="text-muted-foreground mt-2 font-medium">Here's how the jobs are lookin'.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/settings/profile" className="hidden md:flex items-center gap-2 bg-muted text-foreground border border-border px-4 py-3 rounded-md font-bold hover:bg-muted/80 transition-colors uppercase">
            <UserCog className="w-5 h-5" />
            Profile
          </Link>
          <Link href="/calculator" className="hidden md:flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-md font-bold hover:bg-primary/90 transition-colors uppercase">
            <Hammer className="w-5 h-5" />
            New Quote
          </Link>
        </div>
      </div>

      {canViewFinancials && (
        <section aria-labelledby="business-overview-heading" className="space-y-4">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-primary">Owner view</p>
              <h2 id="business-overview-heading" className="mt-1 text-2xl font-black uppercase tracking-tight text-foreground">
                Business Overview
              </h2>
            </div>
            <span className="hidden text-xs font-bold uppercase tracking-wide text-muted-foreground sm:block">
              Live from your quotes
            </span>
          </div>
          {isOverviewError ? (
            <Card className="border-amber-500/40 bg-amber-500/5">
              <CardContent className="p-5 text-sm text-amber-900 dark:text-amber-100">
                Business overview is temporarily unavailable. Your quotes and bookings are still available below.
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <Card className="relative overflow-hidden border-2 border-primary/20 bg-gradient-to-br from-primary/10 via-card to-card shadow-sm">
                <div className="absolute -right-7 -top-7 h-24 w-24 rounded-full bg-primary/10" />
                <CardHeader className="relative flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-xs font-black uppercase tracking-wide text-muted-foreground">Total Pipeline Value</CardTitle>
                  <div className="rounded-lg bg-primary/15 p-2 text-primary"><BriefcaseBusiness className="h-5 w-5" /></div>
                </CardHeader>
                <CardContent className="relative">
                  {isOverviewLoading || !overview ? <Skeleton className="h-9 w-36" /> : (
                    <div className="text-3xl font-black tracking-tight text-foreground">{formatCurrency(overview.totalPipelineValue)}</div>
                  )}
                  <p className="mt-2 text-xs font-medium text-muted-foreground">Sent quotes waiting in the pipeline</p>
                </CardContent>
              </Card>
              <Card className="relative overflow-hidden border-2 border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 via-card to-card shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-xs font-black uppercase tracking-wide text-muted-foreground">YTD Revenue</CardTitle>
                  <div className="rounded-lg bg-emerald-500/15 p-2 text-emerald-600"><DollarSign className="h-5 w-5" /></div>
                </CardHeader>
                <CardContent>
                  {isOverviewLoading || !overview ? <Skeleton className="h-9 w-36" /> : (
                    <div className="text-3xl font-black tracking-tight text-foreground">{formatCurrency(overview.ytdRevenue)}</div>
                  )}
                  <p className="mt-2 text-xs font-medium text-muted-foreground">Accepted quotes this calendar year</p>
                </CardContent>
              </Card>
              <Card className="relative overflow-hidden border-2 border-sky-500/20 bg-gradient-to-br from-sky-500/10 via-card to-card shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-xs font-black uppercase tracking-wide text-muted-foreground">Quote Win Rate</CardTitle>
                  <div className="rounded-lg bg-sky-500/15 p-2 text-sky-600"><Target className="h-5 w-5" /></div>
                </CardHeader>
                <CardContent>
                  {isOverviewLoading || !overview ? <Skeleton className="h-9 w-24" /> : (
                    <>
                      <div className="text-3xl font-black tracking-tight text-foreground">{overview.quoteWinRate.toFixed(1)}%</div>
                      <div className="mt-3 h-2 overflow-hidden rounded-full bg-sky-500/15">
                        <div className="h-full rounded-full bg-sky-500 transition-all duration-500" style={{ width: `${Math.min(100, Math.max(0, overview.quoteWinRate))}%` }} />
                      </div>
                    </>
                  )}
                  <p className="mt-2 text-xs font-medium text-muted-foreground">Accepted versus sent quotes</p>
                </CardContent>
              </Card>
            </div>
          )}
        </section>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {canViewFinancials && <Card className="border-2 border-primary/20 shadow-sm bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-bold uppercase text-muted-foreground">Total Pipeline</CardTitle>
            <FileText className="w-5 h-5 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-foreground">{formatCurrency(data.totalQuoteValue)}</div>
          </CardContent>
        </Card>}
        
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

      {canViewFinancials && (grossProfit > 0 || totalTradeCost > 0) && (
        <Card className="border-2 border-emerald-500/30 bg-emerald-500/5 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="font-display font-black uppercase text-lg flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-500" />
              P&L — Accepted Quotes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-6">
              <div>
                <div className="text-xs font-bold uppercase text-muted-foreground mb-1">Retail Revenue</div>
                <div className="text-2xl font-black text-foreground font-mono">{formatCurrency(grossProfit + totalTradeCost)}</div>
              </div>
              <div>
                <div className="text-xs font-bold uppercase text-muted-foreground mb-1">Trade Cost</div>
                <div className="text-2xl font-black text-foreground font-mono">{formatCurrency(totalTradeCost)}</div>
              </div>
              <div>
                <div className="text-xs font-bold uppercase text-emerald-600 mb-1">Gross Profit</div>
                <div className="text-2xl font-black text-emerald-600 font-mono">
                  {formatCurrency(grossProfit)}
                  {margin !== null && <span className="text-sm font-bold ml-2 text-emerald-500/80">{margin}%</span>}
                </div>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              Trade costs are estimated where not set. Set your trade cost on each material for accurate P&L.
            </p>
          </CardContent>
        </Card>
      )}

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
