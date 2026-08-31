---
name: Clerk profile metadata consistency
description: Durable consistency rules for business profiles stored in Postgres and mirrored to Clerk.
---

Treat Postgres as the business-profile source of truth and mirror current role and trade type to Clerk through a versioned durable outbox. Preserve privileged authorisation separately as `accessRole`.

**Why:** Clerk and Postgres cannot share a transaction. Direct dual writes can lose updates on crashes, leave failed writes unrecoverable, or let older concurrent requests overwrite newer Clerk metadata.

**How to apply:** Commit each profile version and its outbox job atomically. Serialise Clerk delivery per user, supersede stale versions, retry failures with bounded backoff, and never report a stale version as successfully synced.