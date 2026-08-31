---
name: Assignment identity
description: Safety rule for matching authenticated users to team-member job assignments.
---

Do not infer a worker's team-member identity from a name, email, or numeric ID. Resolve assignment access only through the explicit Clerk user link, and let an active link establish assignment mode even if the account has another profile. Time-entry operations must revalidate the live account link and current job assignment in the final read or locked write path.

**Why:** Team members and assignments use business-owned numeric IDs, while authenticated identity uses Clerk user IDs. Mixing owner and linked-worker contexts can expose unrelated records or owner controls. Authorization resolved before a transaction can become stale if an owner unlinks or unassigns the worker concurrently.

**How to apply:** Owners control links and assignments. Linked accounts receive only records assigned under that member's owner and a read-only client experience; unlinked subcontractors receive no assigned records. For mutable worker-owned actions such as time tracking, lock the linked member and assignment rows before writing, and repeat both predicates in the final read query.