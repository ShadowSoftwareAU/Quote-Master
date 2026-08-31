---
name: Master Proposal acceptance evidence
description: Retention and privacy rules for durable customer acceptance of Master Proposals.
---

Record each transition into accepted state as an append-only timestamped snapshot of the exact proposal shown to the customer. Keep the snapshot free of customer identity, owner identity, portal tokens, and builder-only acceptance history. Portal-token rotation or revocation must never alter or erase acceptance evidence, and a completed acceptance must still return success if the token changes immediately after the write.

**Why:** Acceptance evidence may be needed to resolve a dispute long after the live proposal or portal link changes. Re-resolving the old token after committing acceptance can falsely report failure during concurrent link rotation even though the evidence was saved.

**How to apply:** Authorize acceptance with the current high-entropy token inside a row-locked transaction, write the immutable snapshot and status together, then use the stable project identity for the response. Treat repeated acceptance while already accepted as idempotent; a later reopened proposal may create a new acceptance record.