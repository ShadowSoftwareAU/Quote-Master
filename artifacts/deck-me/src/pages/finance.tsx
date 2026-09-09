import { useGetPnlReport } from "@workspace/api-client-react";
import { formatCurrency } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp,
  DollarSign,
  Hammer,
  BarChart2,
  AlertCircle,
  type LucideIcon,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts";

// ── helpers ────────────────────────────────────────────────────────────────

function pct(n: number) {
  return `${n.toFixed(1)}%`;
}

function marginColor(m: number) {
  if (m >= 30) return "text-emerald-600";
  if (m >= 15) return "text-amber-500";
  return "text-red-500";
}

function marginBadge(m: number) {
  if (m >= 30) return "border-emerald-500/40 text-emerald-600 bg-emerald-500/5";
  if (m >= 15) return "border-amber-500/40 text-amber-500 bg-amber-500/5";
  return "border-red-500/40 text-red-500 bg-red-500/5";
}

const ORANGE = "#ff7a00";
const EMERALD = "#22d3a0";
const BLUE = "#4895ef";
const RED = "#ef4444";

// ── stat card ──────────────────────────────────────────────────────────────

function Stat({
  label,
  value,
  sub,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: LucideIcon;
  accent?: boolean;
}) {
  return (
    <Card className={`border-2 shadow-sm ${accent ? "border-primary/40 bg-primary/5" : ""}`}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-bold uppercase text-muted-foreground tracking-wide mb-1">{label}</p>
            <p className={`text-3xl font-black font-mono ${accent ? "text-primary" : ""}`}>{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-1 font-medium">{sub}</p>}
          </div>
          <Icon className={`w-8 h-8 mt-1 ${accent ? "text-primary" : "text-muted-foreground/40"}`} />
        </div>
      </CardContent>
    </Card>
  );
}

// ── custom tooltip ──────────────────────────────────────────────────────────

function AUDTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg p-3 shadow-lg text-sm">
      <p className="font-bold mb-2">{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ backgroundColor: p.fill || p.color }} />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-mono font-bold">{formatCurrency(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

// ── main page ──────────────────────────────────────────────────────────────

export default function FinancePage() {
  const { data, isLoading } = useGetPnlReport();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-10 bg-muted animate-pulse rounded w-48" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-28 bg-muted animate-pulse rounded-lg" />)}
        </div>
        <div className="h-72 bg-muted animate-pulse rounded-lg" />
        <div className="h-64 bg-muted animate-pulse rounded-lg" />
      </div>
    );
  }

  if (!data) return null;

  const { totals, monthly, jobs } = data;

  const hasData = jobs.length > 0;

  const chartData = monthly.map((m) => ({
    name: m.month,
    Revenue: m.revenue,
    "Mat. Cost": m.tradeCost,
    Labour: m.labourCost,
    "Gross Profit": m.grossProfit,
  }));

  const marginChartData = monthly.map((m) => ({
    name: m.month,
    "Margin %": m.marginPct,
  }));

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tight">Financial Report</h1>
          <p className="text-muted-foreground font-medium mt-1">
            P&amp;L per job — trade cost vs retail revenue
          </p>
        </div>
        {hasData && (
          <Badge
            variant="outline"
            className={`text-sm font-bold px-3 py-1 ${marginBadge(totals.marginPct)}`}
          >
            <TrendingUp className="w-3.5 h-3.5 mr-1.5" />
            {pct(totals.marginPct)} overall margin
          </Badge>
        )}
      </div>

      {!hasData ? (
        <div className="text-center py-20 border-2 border-dashed rounded-lg">
          <BarChart2 className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-xl font-bold uppercase mb-2">No Quote Data Yet</h2>
          <p className="text-muted-foreground">Create and accept quotes to see your P&amp;L report.</p>
        </div>
      ) : (
        <>
          {/* ── Totals row ─────────────────────────────────────────── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Stat
              label="Total Revenue"
              value={formatCurrency(totals.revenue)}
              sub={`${totals.jobCount} quote${totals.jobCount !== 1 ? "s" : ""}`}
              icon={DollarSign}
              accent
            />
            <Stat
              label="Materials Cost"
              value={formatCurrency(totals.tradeCost)}
              sub="at trade / estimated"
              icon={Hammer}
            />
            <Stat
              label="Labour Cost"
              value={formatCurrency(totals.labourCost)}
              sub="charged hours"
              icon={Hammer}
            />
            <Stat
              label="Gross Profit"
              value={formatCurrency(totals.grossProfit)}
              sub={`${pct(totals.marginPct)} margin`}
              icon={TrendingUp}
              accent={totals.marginPct >= 20}
            />
          </div>

          {/* ── Monthly stacked bar ────────────────────────────────── */}
          {monthly.length > 1 && (
            <Card className="border-2 shadow-sm">
              <CardHeader className="bg-muted/30 border-b pb-4">
                <CardTitle className="font-display font-black uppercase">Monthly Revenue vs Cost</CardTitle>
              </CardHeader>
              <CardContent className="pt-6 pb-4 px-2">
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={chartData} margin={{ left: 10, right: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fontFamily: "Inter" }} />
                    <YAxis tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                    <Tooltip content={<AUDTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 12, fontFamily: "Inter" }} />
                    <Bar dataKey="Mat. Cost" stackId="cost" fill="#3a3a3a" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="Labour" stackId="cost" fill={BLUE} radius={[0, 0, 0, 0]} />
                    <Bar dataKey="Gross Profit" stackId="cost" fill={EMERALD} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* ── Margin trend line ──────────────────────────────────── */}
          {monthly.length > 1 && (
            <Card className="border-2 shadow-sm">
              <CardHeader className="bg-muted/30 border-b pb-4">
                <CardTitle className="font-display font-black uppercase">Gross Margin % Trend</CardTitle>
              </CardHeader>
              <CardContent className="pt-6 pb-4 px-2">
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={marginChartData} margin={{ left: 10, right: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11 }} domain={[0, 100]} />
                    <Tooltip formatter={(v: number) => [`${v.toFixed(1)}%`, "Margin"]} />
                    <Line
                      type="monotone"
                      dataKey="Margin %"
                      stroke={ORANGE}
                      strokeWidth={2.5}
                      dot={{ fill: ORANGE, r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* ── Per-job table ──────────────────────────────────────── */}
          <Card className="border-2 shadow-sm overflow-hidden">
            <CardHeader className="bg-muted/30 border-b pb-4">
              <CardTitle className="font-display font-black uppercase flex items-center gap-2">
                P&amp;L Per Job
                <span className="text-xs text-muted-foreground font-normal normal-case">
                  — trade cost used where available, 70% of retail assumed otherwise
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40">
                      <th className="text-left px-4 py-3 font-bold uppercase text-xs text-muted-foreground">Job</th>
                      <th className="text-left px-4 py-3 font-bold uppercase text-xs text-muted-foreground">Status</th>
                      <th className="text-right px-4 py-3 font-bold uppercase text-xs text-muted-foreground">Revenue</th>
                      <th className="text-right px-4 py-3 font-bold uppercase text-xs text-muted-foreground hidden md:table-cell">Mat. Cost</th>
                      <th className="text-right px-4 py-3 font-bold uppercase text-xs text-muted-foreground hidden md:table-cell">Labour</th>
                      <th className="text-right px-4 py-3 font-bold uppercase text-xs text-muted-foreground">Profit</th>
                      <th className="text-right px-4 py-3 font-bold uppercase text-xs text-muted-foreground">Margin</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {jobs.map((j) => (
                      <tr key={j.quoteId} className="hover:bg-muted/10 transition-colors">
                        <td className="px-4 py-3">
                          <div className="font-bold text-foreground">{j.title}</div>
                          <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                            {j.customerName}
                            {j.tradeCostIsEstimated && (
                              <span className="text-amber-500 flex items-center gap-0.5">
                                <AlertCircle className="w-3 h-3" /> estimated
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Badge
                            variant="outline"
                            className={`text-xs font-bold uppercase ${
                              j.status === "accepted"
                                ? "border-emerald-500/40 text-emerald-600"
                                : j.status === "sent"
                                  ? "border-blue-500/40 text-blue-500"
                                  : "border-border"
                            }`}
                          >
                            {j.status}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-bold">
                          {formatCurrency(j.revenue)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-muted-foreground hidden md:table-cell">
                          {formatCurrency(j.tradeCost)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-muted-foreground hidden md:table-cell">
                          {formatCurrency(j.labourCost)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-bold">
                          <span className={j.grossProfit >= 0 ? "text-emerald-600" : "text-red-500"}>
                            {formatCurrency(j.grossProfit)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Badge variant="outline" className={`text-xs font-bold ${marginBadge(j.marginPct)}`}>
                            {pct(j.marginPct)}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 bg-muted/30">
                      <td className="px-4 py-3 font-black uppercase text-sm">TOTAL</td>
                      <td />
                      <td className="px-4 py-3 text-right font-mono font-black text-primary">
                        {formatCurrency(totals.revenue)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold hidden md:table-cell">
                        {formatCurrency(totals.tradeCost)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold hidden md:table-cell">
                        {formatCurrency(totals.labourCost)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-black text-emerald-600">
                        {formatCurrency(totals.grossProfit)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Badge variant="outline" className={`text-sm font-black ${marginBadge(totals.marginPct)}`}>
                          {pct(totals.marginPct)}
                        </Badge>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* ── Trade cost coverage note ───────────────────────────── */}
          {jobs.some((j) => j.tradeCostIsEstimated) && (
            <div className="flex items-start gap-3 text-sm text-amber-600 bg-amber-500/5 border border-amber-500/20 rounded-lg px-4 py-3">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <p>
                Some jobs show{" "}
                <strong>estimated</strong> material costs (marked above) — import trade prices via{" "}
                <strong>Materials → Import Trade CSV</strong> for accurate margins.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
