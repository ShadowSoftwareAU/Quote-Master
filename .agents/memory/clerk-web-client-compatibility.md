---
name: Clerk web client compatibility
description: Why Master Project access relies on server-side Clerk sessions rather than a browser Clerk package.
---

Use the server-side Clerk Express integration as the role authority. Do not add the current Clerk React or browser SDK packages to the web workspace while it remains on React 19.1.0.

**Why:** Current mature Clerk packages inherit a peer range that excludes React 19.1.0, while the shared mobile workspace requires that version. Overriding the peer constraint risks destabilising Expo for no benefit because role enforcement belongs on the API.

**How to apply:** The web navigation may discover access by calling the protected Master Projects endpoint, but all create, update, assignment, and delete checks must remain server-side. Revisit a browser SDK only when its peer range supports the workspace React version or the shared React version changes safely.