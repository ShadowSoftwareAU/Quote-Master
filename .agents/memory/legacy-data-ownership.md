---
name: Legacy data ownership
description: Safe staged ownership migration for records created before Clerk authentication.
---

Keep Clerk ownership columns nullable and indexed until every legacy row has a confirmed owner. Do not guess a Clerk user ID or assign all historical data to whichever account is currently signed in.

**Why:** Existing business records predate authentication and contain no reliable owner mapping. A guessed backfill could expose one user’s data to another or permanently misattribute records.

**How to apply:** Require Clerk ownership for new writes and filter authenticated reads by that ownership. Backfill historical rows only after the project owner confirms the correct Clerk account mapping, then consider adding `NOT NULL` constraints.