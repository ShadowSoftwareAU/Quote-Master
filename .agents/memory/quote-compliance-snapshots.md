---
name: Quote compliance snapshots
description: How quote compliance text and licence details balance auditability with legacy data.
---

New quotes and variations must snapshot the compliance statement, saved trade classification, and licence number at creation. Legacy quotes retain null snapshot fields so reads and PDFs can fall back to the quote owner's current business profile.

**Why:** Quote documents need an auditable record of the profile details used when created, but older quotes predate those fields and still need complete customer-facing documents.

**How to apply:** Keep new writes explicit and immutable. Do not add database defaults that make legacy rows appear snapshotted. Use current-profile fallback only when a snapshot field is null.