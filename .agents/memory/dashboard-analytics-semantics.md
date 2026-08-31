---
name: Dashboard analytics semantics
description: Stable business definitions for owner-only dashboard metrics.
---

Total pipeline value is the total of quotes currently marked Sent. YTD revenue is the total of Accepted quotes created during the current calendar year. Quote win rate is Accepted divided by Sent plus Accepted, expressed as a percentage.

**Why:** Drafts are not customer decisions, and including them would make the win rate misleading. Using one definition across API, Web, and Mobile prevents conflicting demo and reporting figures.

**How to apply:** Keep these definitions server-authoritative. Any future dashboard, export, or chart using these labels should consume the same endpoint or apply exactly the same status and date boundaries.