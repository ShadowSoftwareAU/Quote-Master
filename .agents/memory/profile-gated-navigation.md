---
name: Profile-gated navigation
description: Cross-platform guard rules for requiring a business profile after Clerk authentication.
---

Key profile queries by Clerk user ID and wait for authentication plus API token configuration before checking profile state. On Expo, keep the root navigator mounted while guarded redirects settle and cover protected content with an input-blocking loading layer.

**Why:** A shared profile cache can briefly authorise the wrong account after an identity switch. Replacing Expo's root navigator with a root-level redirect can also produce a permanent blank screen.

**How to apply:** Clear user-scoped caches on auth changes, include the current Clerk user ID in profile query keys, distinguish missing-profile 404s from operational errors, and never unmount Expo's root navigator to perform a guard redirect.