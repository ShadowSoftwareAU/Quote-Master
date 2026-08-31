import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => readFile(path.join(root, relative), "utf8");
const failures = [];

function check(name, condition, detail) {
  if (!condition) failures.push(`${name}: ${detail}`);
}

function containsAll(source, fragments) {
  return fragments.every((fragment) => source.includes(fragment));
}

const [
  app,
  auth,
  customers,
  materials,
  quotes,
  bookings,
  team,
  time,
  portfolio,
  referrals,
  dashboard,
  pdf,
  masterProjects,
  masterProjectService,
] = await Promise.all([
  read("src/app.ts"),
  read("src/middlewares/apiAuth.ts"),
  read("src/routes/customers.ts"),
  read("src/routes/materials.ts"),
  read("src/routes/quotes.ts"),
  read("src/routes/bookings.ts"),
  read("src/routes/team.ts"),
  read("src/routes/time.ts"),
  read("src/routes/portfolio.ts"),
  read("src/routes/referrals.ts"),
  read("src/routes/dashboard.ts"),
  read("src/routes/pdf.ts"),
  read("src/routes/master-projects.ts"),
  read("src/services/masterProjects.ts"),
]);

// Boundary/auth transport checks. Clerk's middleware is the component which
// validates both __session cookies and Authorization: Bearer tokens. This
// checker intentionally does not forge either credential.
const clerkAt = app.indexOf("clerkMiddleware(");
const authAt = app.indexOf('app.use("/api", requireApiAuth)');
const routerAt = app.indexOf('app.use("/api", router)');
check(
  "cookie and bearer boundary",
  clerkAt >= 0 && authAt > clerkAt && routerAt > authAt,
  "clerkMiddleware must precede requireApiAuth, which must precede the API router",
);
check(
  "verified identity",
  containsAll(auth, [
    "const auth = getAuth(req)",
    "req.clerkUserId = auth.userId",
    "hasBodyClerkUserId(req)",
    "clerkUserId must not be supplied",
  ]),
  "the boundary must derive ownership from Clerk and reject a spoofed body clerkUserId",
);
check(
  "no route trusts spoofed identity",
  ![
    customers,
    materials,
    quotes,
    bookings,
    team,
    time,
    portfolio,
    referrals,
    dashboard,
    pdf,
    masterProjects,
  ].some((source) =>
    /(?:req\.body|body\.data|parsed\.data|\bd)\s*(?:\.\s*clerkUserId|\[\s*["']clerkUserId["']\s*\])/.test(
      source,
    ),
  ),
  "a route reads clerkUserId from request-controlled input",
);

// Public quote behavior is deliberately narrow: token-bound portal read, the
// two cosmetic upgrade fields, and acceptance only. Exact key checks prevent a
// nested/extra-field payload from smuggling a privileged update.
check(
  "public quote allowlist",
  containsAll(auth, [
    'req.method === "GET"',
    "PUBLIC_QUOTE_PORTAL_PATH.test(path)",
    'req.method === "PATCH"',
    "isPublicUpgradeRequest(req) || isPublicAcceptanceRequest(req)",
    'keys.length !== 1 || keys[0] !== "status"',
    'parsed.data.status === "accepted"',
    'new Set(["deckBoardType", "balustradeType"])',
  ]),
  "public access must remain limited to the documented quote portal operations",
);
check(
  "public response redaction",
  containsAll(quotes, [
    "function publicQuoteResponse",
    "function publicLineItem",
    "labourHours: _labourHours",
    "labourRate: _labourRate",
    "res.json(publicQuoteResponse(quote))",
  ]),
  "public quote responses must use the redacted projection",
);

// Root CRUD predicates. Equality with the verified Clerk user simultaneously
// models user A != user B and SQL NULL ownership: neither user B's rows nor
// NULL-owned legacy rows satisfy these predicates.
const rootScopes = [
  ["customers", customers, "customersTable.clerkUserId, userId"],
  ["materials", materials, "materialsTable.clerkUserId, userId"],
  ["quotes", quotes, "quotesTable.clerkUserId, userId"],
  ["bookings", bookings, "bookingsTable.clerkUserId, userId"],
  ["team", team, "teamMembersTable.clerkUserId, userId"],
  ["portfolio", portfolio, "portfolioEntriesTable.clerkUserId, userId"],
  ["referral sources", referrals, "referralSourcesTable.clerkUserId, clerkUserId"],
  ["referral leads", referrals, "signUpLeadsTable.clerkUserId, clerkUserId"],
];
for (const [name, source, ownershipPredicate] of rootScopes) {
  check(
    `${name} two-user/null isolation`,
    source.includes(ownershipPredicate),
    `missing verified-user ownership predicate ${ownershipPredicate}`,
  );
}

// Nested records do not all carry clerkUserId, so they must be reached through
// an already scoped parent. These assertions cover the historically dangerous
// quote-line, assignment, time-entry, and master-project bypasses.
const nestedScopes = [
  [
    "quote line items in quote CRUD",
    quotes,
    ["quotesTable.clerkUserId, userId", "quoteLineItemsTable.quoteId"],
  ],
  [
    "quote line items in dashboard",
    dashboard,
    ["quotesTable.clerkUserId, clerkUserId", "quoteLineItemsTable.quoteId"],
  ],
  [
    "quote line items in PDF",
    pdf,
    ["quotesTable.clerkUserId, clerkUserId", "quoteLineItemsTable.quoteId"],
  ],
  [
    "quote line items in master projects",
    masterProjectService,
    ["quotesTable.clerkUserId, clerkUserId", "quoteLineItemsTable.quoteId"],
  ],
  [
    "job assignments",
    team,
    ["bookingsTable.clerkUserId, userId", "teamMembersTable.clerkUserId, userId"],
  ],
  [
    "time entries",
    time,
    ["getAuth(req).userId", "bookingsTable.clerkUserId", "teamMembersTable.clerkUserId"],
  ],
  [
    "master projects",
    masterProjects + masterProjectService,
    ["customersTable.clerkUserId, clerkUserId", "quotesTable.clerkUserId, clerkUserId"],
  ],
];
for (const [name, source, guards] of nestedScopes) {
  check(
    `${name} nested isolation`,
    containsAll(source, guards),
    `nested access must be constrained through all owners (${guards.join(", ")})`,
  );
}

// Guard against broadening an ownership predicate to include unowned rows.
const allIsolationSources = [
  customers,
  materials,
  quotes,
  bookings,
  team,
  time,
  portfolio,
  referrals,
  dashboard,
  pdf,
  masterProjects,
  masterProjectService,
].join("\n");
check(
  "null-owned records",
  !/(?:isNull|IS\s+NULL)\s*\([^)]*clerkUserId|clerkUserId[^;\n]*(?:isNull|IS\s+NULL)/i.test(
    allIsolationSources,
  ),
  "NULL clerkUserId rows must not be included as shared records",
);

check(
  "assigned quote responses hide portal tokens",
  quotes.includes("portalToken: userId && !member ? row.q.portalToken : null"),
  "assigned quote detail must not return a customer portal write token",
);
check(
  "booking customer joins stay tenant scoped",
  bookings.split("customersTable.clerkUserId, bookingsTable.clerkUserId").length - 1 >= 2,
  "booking list/detail customer joins must use the booking owner",
);

if (failures.length) {
  console.error(`API isolation regression check failed (${failures.length}):`);
  for (const failure of failures) console.error(`  - ${failure}`);
  console.error(
    "\nLive Clerk cookie/bearer cryptographic verification requires real Clerk test sessions; this static check does not fabricate credentials.",
  );
  process.exitCode = 1;
} else {
  assert.equal(failures.length, 0);
  console.log("API isolation regression check passed (root, nested, spoofing, public quote, and auth wiring).");
  console.log(
    "Not automated: live Clerk cookie/bearer cryptographic verification, which requires real Clerk test sessions.",
  );
}