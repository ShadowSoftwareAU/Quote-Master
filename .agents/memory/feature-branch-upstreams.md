---
name: Feature branch upstreams
description: How to avoid false Git divergence when synchronising project feature branches.
---

Feature branches must track the matching feature branch on `origin`, rather than treating `origin/main` as their pull target.

**Why:** A feature branch can legitimately diverge from main while already matching its remote feature branch exactly. Pulling main with `--ff-only` then reports divergence even though feature work is fully synchronised.

**How to apply:** Fetch remote branches, check whether a matching feature branch exists, set it as the upstream, and use normal fast-forward pulls and non-force pushes. Do not merge or rebase main merely to repair missing tracking configuration.