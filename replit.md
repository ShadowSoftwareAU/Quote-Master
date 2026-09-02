# Quote Master

A full-stack business management app for Australian decking tradies, calculate deck quotes, manage jobs, track team time, and run financial reports. Hi-vis orange (#ff7a00) + dark steel aesthetic throughout.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)
- Web: React + Vite + Tailwind + shadcn/ui
- Mobile: Expo (React Native)
- Charts: Recharts (web)

## Where things live

- `lib/api-spec/openapi.yaml` — source of truth for all API contracts
- `lib/api-client-react/src/generated/` — Orval-generated React Query hooks (never edit manually)
- `lib/api-zod/src/generated/` — Orval-generated Zod schemas (never edit manually)
- `lib/db/src/schema/` — Drizzle ORM schema (source of truth for DB shape)
- `artifacts/api-server/src/routes/` — Express route handlers
- `artifacts/api-server/src/lib/estimator.ts` — deck BOM calculation engine
- `artifacts/deck-me/src/pages/` — web app pages
- `artifacts/deck-me-mobile/app/(tabs)/` — mobile tab screens

## Architecture decisions

- **Contract-first API**: All endpoints are defined in OpenAPI before implementation. Clients consume generated hooks; server validates with generated Zod schemas.
- **pdfkit externalized in esbuild**: pdfkit → fontkit → @swc/helpers can't be bundled; add `"pdfkit"` to the `external` array in `build.mjs` if re-adding.
- **Retail/trade price split**: Mobile app shows retail prices only (`unitPrice`). Web dashboard shows trade cost + margin %. This protects tradie margin if clients see the phone.
- **P&L estimation**: Where `tradeCost` is null on a material, the estimator falls back to 70% of retail (assumes 30% margin). Users are warned with an "estimated" badge and prompted to import a trade CSV.
- **Mobile privacy pre-screen**: Mobile home tab shows a 4-tile locked landing screen — no financial data visible until user taps into a section.

## Product

- **Calculator**: Full deck BOM with dimensions, board type, fastener type, subframe, handrails, stairs, fencing, awning. Multi-supplier price comparison (Bunnings vs Mitre 10) with cheapest highlighted.
- **Quotes**: Save estimates as quotes, manage status (draft → sent → accepted/rejected), create variations, download PDF.
- **PDF Export**: `GET /api/quotes/:id/pdf` generates a branded A4 PDF with BOM, totals, council warning if height ≥1m.
- **Materials**: Catalogue with retail + trade cost per item, bulk trade CSV import, margin % display.
- **Customers / Bookings / Jobs**: CRM + job scheduling with site photos.
- **Team**: Member management, job assignment, clock-on/off time tracking.
- **Planner**: Weekly calendar view for job scheduling.
- **Gallery/Portfolio**: Before/after job photos with filtering.
- **Referrals**: QR-code referral links + lead tracking.
- **Finance**: P&L per job (revenue vs trade cost vs labour), monthly rollup chart, margin % trend, gross profit summary.
- **Mobile Privacy Screen**: 4-tile home screen hides all financial data until a section is tapped.

## User preferences

- Australian locale throughout (AUD, en-AU date formatting, "tradie" language).
- Hi-vis orange `#ff7a00` + dark steel `#1a1a1a` colour palette.
- All headings in UPPERCASE with tight tracking.
- Bold typography: Chivo Black for headings, Inter for body.

## Gotchas

- **Always run codegen after editing `openapi.yaml`**: `pnpm --filter @workspace/api-spec run codegen`
- **Always run `pnpm --filter @workspace/db run push` after schema changes**
- **pdfkit must be in esbuild `external` array** — it pulls in fontkit/@swc/helpers which can't be bundled
- **Webhook route must be registered BEFORE `express.json()` middleware** (for future Stripe integration)
- Mobile calculator shows RETAIL prices only — never display `tradeCost` on mobile

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
