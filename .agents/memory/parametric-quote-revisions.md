---
name: Parametric quote revisions
description: Durable trust and persistence rules for template-driven quote calculations.
---

Parametric template revisions and BOM line identity are immutable, server-owned evidence. Store exact template, parameter and line snapshots with each quote, and preserve them across every mutation path.

**Why:** Recalculating from current templates, trusting client modifiers, or falling back to legacy estimators can silently change prices, erase manual-override evidence, or expose internal costing in public responses.

**How to apply:** Resolve the exact template ID and revision server-side, validate complete parameter inputs, derive automatic line identity and modifiers from the stored template, and fail closed when an operation cannot safely preserve the representation. Public responses must use an explicit customer-safe allowlist.

Categorical upgrades may reprice a frozen BOM only when one compatible line and one catalog material can be identified unambiguously. Preserve quantities, manual overrides, rule identity and prior representation evidence; reject assembly changes that require different quantity semantics.

**Why:** Treating a material substitution like a fresh legacy estimate can erase parametric evidence, while repricing an ambiguous line or an assembly-changing option can produce a plausible but unsupported total.

**How to apply:** Keep decking material substitutions narrow and unit-compatible, archive the prior representation, and reject options such as balustrade assembly changes until the frozen revision carries an explicit transformation rule.