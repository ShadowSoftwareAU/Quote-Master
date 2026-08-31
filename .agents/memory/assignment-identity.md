---
name: Assignment identity
description: Safety rule for matching authenticated users to team-member job assignments.
---

Do not infer a Subcontractor's team-member identity from a name, email, or numeric ID. Resolve assignment-filtered access only through the explicit Clerk user link on the intended team member, and require the assignment owner to match the record owner.

**Why:** Team members and assignments use business-owned numeric IDs, while authenticated identity uses Clerk user IDs. Both the trusted link and same-business predicate are needed to prevent malformed or cross-business assignments exposing work.

**How to apply:** Owners control the link and assignment. Quote, booking, and Master Project reads must join through the linked active team member server-side. Subcontractors receive read-only quote access, and unlinked users receive no assigned records.