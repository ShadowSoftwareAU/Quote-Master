---
name: Public quote API boundary
description: Security rule for keeping customer quote acceptance open without exposing staff quote controls.
---

Keep the customer quote portal public, but allow anonymous writes only for the customer-selectable decking and balustrade upgrades and the `accepted` status transition. Full quote editing remains authenticated. When a public upgrade changes quote pricing, update any linked project aggregates atomically using the quote's stored owner.

**Why:** The customer must be able to review and accept a quote without creating an account, but reusing unrestricted staff update endpoints would let anyone with a numeric quote ID change customer, scope, labour, pricing, or status fields. Public pricing changes can otherwise leave linked project totals stale because no authenticated caller identity is present.

**How to apply:** Any new public quote operation must use a strict allowlist and an explicit schema. Do not broaden the anonymous update payload. For derived updates, use the persisted quote owner inside the same transaction rather than trusting request identity. Consider an unguessable capability token before exposing more sensitive customer actions.