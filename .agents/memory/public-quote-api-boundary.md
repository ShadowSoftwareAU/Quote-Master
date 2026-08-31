---
name: Public quote API boundary
description: Security rule for keeping customer quote acceptance open without exposing staff quote controls.
---

Keep the customer quote portal public, but allow anonymous writes only for the customer-selectable decking and balustrade upgrades and the `accepted` status transition. Full quote editing remains authenticated.

**Why:** The customer must be able to review and accept a quote without creating an account, but reusing unrestricted staff update endpoints would let anyone with a numeric quote ID change customer, scope, labour, pricing, or status fields.

**How to apply:** Any new public quote operation must use a strict allowlist and an explicit schema. Do not broaden the anonymous update payload. Consider an unguessable capability token before exposing more sensitive customer actions.