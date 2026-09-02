# Quote Master

## App purpose and intentions

Quote Master is an Australian-focused quoting and business management platform for builders, tradespeople, employees and subcontractors.

Its main intention is to bring the full job workflow into one system:

1. Calculate the materials and labour needed for a job.
2. Build an accurate, professional quote.
3. Send a customer-safe proposal for review and acceptance.
4. Schedule the work and assign the right people.
5. Track job progress, costs, revenue and profit.
6. Keep business records, compliance information and acceptance evidence organised.

The web app is designed for business administration and detailed management. The mobile app is designed for quoting, customer management and field access while on the job.

## Main users and access

- **Owner:** Full access to quoting, customers, materials, bookings, projects, team management, analytics and financial information.
- **Employee:** Can work with operational features such as quotes and bookings, without access to restricted financial or team-management information.
- **Subcontractor:** Can only see the quotes, projects and bookings explicitly assigned to them.
- **Master Builder:** Can manage Master Projects that combine multiple trade quotes into a consolidated proposal.
- **Customer:** Can securely review and accept shared quotes or Master Proposals through a public portal.

Access is enforced through both the app interface and the server. Sensitive information is not merely hidden on screen.

## Current feature outline

### Authentication and business setup

- Secure Clerk sign-in and sign-up on web and mobile.
- Google and Apple sign-in support on mobile where enabled in Clerk.
- Guided business onboarding.
- Business profile and contractor details.
- Role-based access controls.
- Protected routes and user-owned business records.

### Dashboard and business overview

- Owner dashboard with business performance summaries.
- Quote pipeline and status tracking.
- Year-to-date revenue reporting.
- Win-rate and quote-conversion insights.
- Recent business activity and operational summaries.

### Quote calculator

- Detailed job measurements and specifications.
- Material and labour calculations.
- Decking, subframe, posts, footings, fasteners, fascia, handrails, stairs, fencing and related job inputs.
- Adjustable wastage allowances.
- Bulk and full-box quantity rounding.
- Three-decimal quantity precision.
- Two-decimal money and mark-up precision.
- Server-authoritative totals to prevent client-side manipulation.
- Fixed Australian GST calculation at 10 percent.
- Compliance warnings for relevant job conditions.

### Quotes and proposals

- Create, edit, save and manage quotes.
- Draft, sent, accepted and rejected quote stages.
- Customer and site-address linking.
- Custom line descriptions, quantities, units, costs and mark-ups.
- Reordering and editing of quote line items.
- Quote variations.
- Assignment to employees or subcontractors.
- Accepted quote protection and preserved acceptance evidence.
- Quote totals are checked and normalised when saving, preventing values from unexpectedly changing later.

### Customer management

- Store customer contact and address information.
- Link customers to quotes and bookings.
- View customer-related work from the business workspace.
- Use saved customer details during the quoting process.

### Materials and supplier pricing

- Business-owned material catalogue.
- Retail and trade pricing.
- Vendor names, supplier SKUs and last-updated information.
- Material mark-up and margin visibility for authorised users.
- Trade-specific material templates.
- Personal, trade-scoped quote item presets.
- CSV material price importing for stakeholder demonstrations.
- Finlaysons import workflow.
- Deterministic Bunnings Trade substitution suggestions for unavailable products.
- Optional catalogue updates after importing supplier prices.

### Bookings and planning

- Create and manage job bookings.
- Link bookings to customers and quotes.
- Calendar and planning views.
- Assign work to team members.
- Restrict subcontractors to their assigned bookings.
- Time-entry support for job and labour tracking.

### Team management

- Create and manage team-member records.
- Owner-controlled Employee and Subcontractor roles.
- Link authenticated users to team-member assignments.
- Assign and remove people from work.
- Keep financial and team-management screens unavailable to restricted roles.

### Financial reporting

- Owner-only financial views.
- Profit and loss reporting.
- Monthly and job-level financial summaries.
- Revenue, cost and margin reporting.
- Internal labour costs, trade prices and mark-ups are excluded from customer-facing portals and PDFs.

### Customer quote portal

- Secure customer access using a random portal link.
- Customer-safe quote and line-item presentation.
- Optional upgrade selections.
- Quote acceptance.
- Append-only acceptance evidence.
- Portal-link regeneration and revocation.
- No-store browser caching for sensitive portal responses.

### PDFs

- Branded A4 quote and proposal PDFs.
- Existing PDFKit document generation.
- Business and contractor details.
- Quote totals, GST and customer-safe line items.
- Australian compliance and council-warning wording where relevant.
- No internal costs, labour rates, trade prices or mark-ups in customer PDFs.

### Master Projects and Master Proposals

- Combine several trade quotes into one Master Project.
- Group quotes by trade.
- Consolidate bill-of-material quantities and totals.
- Apply builder margin and GST.
- Create a secure Master Proposal customer portal.
- Let customers review and accept the consolidated proposal.
- Preserve acceptance history and snapshots.
- Restrict assigned subcontractors to the relevant work.
- Transactional and idempotent acceptance safeguards.

### Portfolio and referrals

- Store project portfolio entries and photos.
- Record referral sources.
- Track where new work and customer enquiries came from.

### Demo and presentation support

- Development-only demonstration data.
- Owner-only demo data controls.
- User-scoped, idempotent and transactional seeding.
- Sample customers, materials, quotes and Master Projects for stakeholder presentations.

### Reliability, privacy and audit safeguards

- Zod and Drizzle validation at application boundaries.
- Server-side ownership and permission checks.
- Server-side quote recalculation.
- Database transactions for critical writes.
- Customer-safe public API responses.
- Accepted proposal snapshots that remain available independently of portal-link changes.
- Assignment filtering for restricted users.
- Audit-friendly acceptance records.
- Explicit errors instead of silently saving invalid states.

## Web app areas

- Dashboard
- Calculator
- Quotes and quote details
- Customers
- Materials and smart importing
- Bookings and planner
- Team
- Portfolio
- Referrals
- Financials
- Master Projects
- Business profile and onboarding
- Public quote and Master Proposal portals

## Mobile app areas

- Secure sign-in and onboarding
- Home and privacy-focused navigation
- Quote calculator
- Quotes and quote details
- Customers
- Materials
- Bookings
- Master Projects
- Business profile

## Intended business outcomes

Quote Master is intended to help Australian trade businesses:

- Produce accurate quotes faster.
- Reduce missed materials and calculation mistakes.
- Keep GST and mark-ups consistent.
- Protect internal pricing from customers and subcontractors.
- Give customers a clear, professional acceptance experience.
- Coordinate owners, employees and subcontractors safely.
- Preserve reliable records when a proposal is accepted.
- Understand revenue, margins and job profitability.
- Move from initial measurement to accepted work without juggling disconnected spreadsheets, messages and documents.

## Future product direction

The broader product direction may include deeper accounting, supplier, payment, communication, receipt-processing, visualisation and automation integrations. These are product opportunities rather than confirmed current features unless separately implemented and verified.
