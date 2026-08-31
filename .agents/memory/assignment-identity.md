---
name: Assignment identity
description: Safety rule for matching authenticated users to team-member job assignments.
---

Do not infer a Subcontractor's team-member identity from a name, email, or numeric ID. Assignment-filtered screens must fail closed until the account has an explicit, trusted team-member link.

**Why:** Team members and job assignments use numeric IDs owned by a business account, while authenticated identity uses Clerk user IDs. There is currently no trustworthy mapping between them, and guessing could expose another worker's quotes or bookings.

**How to apply:** Add an invitation or account-linking flow that stores the Clerk user ID against the intended team member, then return current-user assignment data from an authenticated API boundary. Only then show matched records.