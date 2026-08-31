---
name: Clerk web client compatibility
description: Clerk transport and React alignment rules for the shared web and Expo workspace.
---

Keep role authority in the server-side Clerk Express integration. Web uses Clerk cookies, while Expo registers a Bearer-token getter with the shared API client. Keep every workspace package on React 19.1.0 while Expo requires it.

**Why:** Metro resolves some peerless packages through pnpm's hidden virtual-store hoist. A second web React version can therefore enter the Expo bundle and cause invalid-hook failures even when normal Node resolution reports React 19.1.0. Clerk's peer warning is less harmful than splitting the renderer runtime.

**How to apply:** Never register the Expo token getter in web code. Keep all React and React DOM declarations catalogue-aligned. After changing React versions, run a full pnpm install, not only a filtered install, and confirm the Expo bundle contains one React runtime.