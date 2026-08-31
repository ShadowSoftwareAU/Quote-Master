---
name: Drizzle constraint errors
description: How to identify exact PostgreSQL constraint violations through Drizzle's wrapped query errors.
---

When an API needs to map a specific PostgreSQL constraint violation to a predictable response, inspect a short, bounded `cause` chain and match both SQLSTATE and the exact constraint name.

**Why:** Drizzle can wrap the native PostgreSQL error in a query error. Reading `code` and `constraint` only from the outer error can miss a real `23505` and incorrectly return a server error during a concurrency race.

**How to apply:** Keep matching narrow so unrelated unique violations are not misreported. Cover the mapping with a deterministic database-backed race test rather than relying on two unsynchronised requests.