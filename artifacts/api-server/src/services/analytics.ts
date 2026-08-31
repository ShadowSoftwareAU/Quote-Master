import { eq, sql } from "drizzle-orm";
import { db, quotesTable } from "@workspace/db";

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export async function getAnalyticsOverview(clerkUserId: string) {
  const yearStart = new Date(new Date().getFullYear(), 0, 1);
  const [overview] = await db
    .select({
      pipelineValue: sql<string>`coalesce(sum(${quotesTable.total}) filter (where ${quotesTable.status} = 'sent'), 0)`,
      ytdRevenue: sql<string>`coalesce(sum(${quotesTable.total}) filter (where ${quotesTable.status} = 'accepted' and ${quotesTable.createdAt} >= ${yearStart}), 0)`,
      sentCount: sql<number>`count(*) filter (where ${quotesTable.status} = 'sent')::int`,
      acceptedCount: sql<number>`count(*) filter (where ${quotesTable.status} = 'accepted')::int`,
    })
    .from(quotesTable)
    .where(eq(quotesTable.clerkUserId, clerkUserId));

  const sentCount = Number(overview?.sentCount ?? 0);
  const acceptedCount = Number(overview?.acceptedCount ?? 0);
  const decidedCount = sentCount + acceptedCount;

  return {
    totalPipelineValue: roundMoney(Number(overview?.pipelineValue ?? 0)),
    ytdRevenue: roundMoney(Number(overview?.ytdRevenue ?? 0)),
    quoteWinRate: decidedCount > 0
      ? roundMoney((acceptedCount / decidedCount) * 100)
      : 0,
  };
}