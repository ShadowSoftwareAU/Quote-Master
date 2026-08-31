---
name: Personal trade presets
description: Ownership and consistency rules for quote-builder items saved for future reuse.
---

Personal quote presets must remain separate from the globally seeded trade templates. Scope every preset by verified Clerk user identity and the user’s server-side primary trade. Treat the item description as an idempotent key within that user and trade, updating an existing preset rather than creating repeated copies.

**Why:** Shared templates are catalogue data, while learned presets are private business data. Mixing them would risk cross-user disclosure and make global seed maintenance unsafe. Saving the preset outside quote creation could also report a successful quote while silently losing the user’s checked preset.

**How to apply:** Derive identity and trade on the server, never from request fields. When a quote line is marked for preset reuse, upsert the preset inside the same database transaction as the quote. Quick-add must append the preset without replacing unrelated populated lines.