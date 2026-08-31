---
name: Line-item wastage
description: How quote quantities remain stable after wastage and bulk-unit rounding.
---

Persist the effective required quantity after applying line-level wastage and any whole-unit bulk rounding. Treat loaded quote lines as already calculated.

**Why:** Reapplying wastage when editing a quote or creating a variation silently compounds quantities and prices.

**How to apply:** Apply wastage only at an input boundary. When copying or recalculating stored lines, preserve their quantity, wastage percentage, bulk flag, and total without feeding them through the input calculation again.

Quote creation previews on web and mobile should mirror this same input-boundary calculation so builders see the persisted effective quantity before saving.

**Why:** A preview that uses raw quantity while the server persists the wastage-adjusted quantity makes the displayed margin and total misleading.

**How to apply:** Use three-decimal rounding for ordinary lines and whole-unit ceiling for bulk lines, then apply unit cost and mark-up to that effective quantity.