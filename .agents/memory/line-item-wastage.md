---
name: Line-item wastage
description: How quote quantities remain stable after wastage and bulk-unit rounding.
---

Persist the effective required quantity after applying line-level wastage and any whole-unit bulk rounding. Treat loaded quote lines as already calculated.

**Why:** Reapplying wastage when editing a quote or creating a variation silently compounds quantities and prices.

**How to apply:** Apply wastage only at an input boundary. When copying or recalculating stored lines, preserve their quantity, wastage percentage, bulk flag, and total without feeding them through the input calculation again.