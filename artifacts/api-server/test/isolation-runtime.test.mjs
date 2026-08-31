import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";

let tempDir;
let requireApiAuth;
const originalClerkSecret = process.env.CLERK_SECRET_KEY;
const originalClerkPublishable = process.env.CLERK_PUBLISHABLE_KEY;

before(async () => {
  process.env.CLERK_SECRET_KEY = "fixture-secret";
  process.env.CLERK_PUBLISHABLE_KEY = "fixture-publishable";
  tempDir = await mkdtemp(path.join(os.tmpdir(), "api-auth-isolation-"));
  await build({
    entryPoints: [path.resolve("src/middlewares/apiAuth.ts")],
    outfile: path.join(tempDir, "api-auth.mjs"),
    bundle: true,
    platform: "node",
    format: "esm",
    plugins: [{
      name: "fixture-clerk",
      setup(buildContext) {
        buildContext.onResolve({ filter: /^@clerk\/express$/ }, () => ({
          path: "fixture-clerk",
          namespace: "fixture",
        }));
        buildContext.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({
          // These are deliberately non-credentials. They model Clerk's already
          // verified output for its cookie and bearer transports.
          contents: `
            export function getAuth(req) {
              if (req.headers.authorization === "Bearer fixture-bearer-user-a") {
                return { userId: "user_a" };
              }
              if (req.headers.cookie === "__session=fixture-cookie-user-b") {
                return { userId: "user_b" };
              }
              return { userId: null };
            }
          `,
          loader: "js",
        }));
      },
    }],
  });
  ({ requireApiAuth } = await import(pathToFileURL(path.join(tempDir, "api-auth.mjs")).href));
});

after(async () => {
  if (tempDir) await rm(tempDir, { recursive: true, force: true });
  if (originalClerkSecret === undefined) delete process.env.CLERK_SECRET_KEY;
  else process.env.CLERK_SECRET_KEY = originalClerkSecret;
  if (originalClerkPublishable === undefined) delete process.env.CLERK_PUBLISHABLE_KEY;
  else process.env.CLERK_PUBLISHABLE_KEY = originalClerkPublishable;
});

function request({ method, path: requestPath, body, headers = {} }) {
  return { method, path: requestPath, body, headers };
}

function invoke(req) {
  let statusCode;
  let response;
  let nextCalled = false;
  requireApiAuth(
    req,
    {
      status(code) {
        statusCode = code;
        return this;
      },
      json(value) {
        response = value;
      },
    },
    () => {
      nextCalled = true;
    },
  );
  return { nextCalled, statusCode, response };
}

test("bearer fixture installs the verified user A context", () => {
  const req = request({
    method: "GET",
    path: "/customers",
    headers: { authorization: "Bearer fixture-bearer-user-a" },
  });
  assert.deepEqual(invoke(req), { nextCalled: true, statusCode: undefined, response: undefined });
  assert.equal(req.clerkUserId, "user_a");
});

test("cookie fixture installs the verified user B context", () => {
  const req = request({
    method: "GET",
    path: "/customers",
    headers: { cookie: "__session=fixture-cookie-user-b" },
  });
  assert.equal(invoke(req).nextCalled, true);
  assert.equal(req.clerkUserId, "user_b");
});

test("a request body cannot spoof clerkUserId for either transport", () => {
  for (const headers of [
    { authorization: "Bearer fixture-bearer-user-a" },
    { cookie: "__session=fixture-cookie-user-b" },
  ]) {
    const result = invoke(request({
      method: "POST",
      path: "/customers",
      headers,
      body: { name: "Attempt", clerkUserId: "user_b" },
    }));
    assert.equal(result.nextCalled, false);
    assert.equal(result.statusCode, 400);
    assert.match(result.response.error, /must not be supplied/);
  }
});

test("private routes deny an unauthenticated request", () => {
  assert.deepEqual(
    invoke(request({ method: "GET", path: "/customers" })),
    { nextCalled: false, statusCode: 401, response: { error: "Unauthorized" } },
  );
});

test("only the exact public quote routes bypass authentication", () => {
  const token = "A".repeat(43);
  const allowed = [
    request({ method: "GET", path: `/quote/${token}` }),
    request({ method: "PATCH", path: `/quote/${token}`, body: { deckBoardType: "treated_pine" } }),
    request({ method: "PATCH", path: `/quote/${token}`, body: { balustradeType: "timber" } }),
    request({ method: "PATCH", path: `/quote/${token}/status`, body: { status: "accepted" } }),
  ];
  for (const req of allowed) assert.equal(invoke(req).nextCalled, true, `${req.method} ${req.path}`);

  const denied = [
    request({ method: "GET", path: "/quotes/42" }),
    request({ method: "POST", path: "/quotes/estimate", body: { lengthM: 2, widthM: 2 } }),
    request({ method: "GET", path: "/quotes/42/portal" }),
    request({ method: "POST", path: "/onboarding", body: {} }),
    request({ method: "PUT", path: "/settings/profile", body: {} }),
    request({ method: "GET", path: `/quote/${token}/extra` }),
    request({ method: "GET", path: "/quote/too-short" }),
    request({ method: "POST", path: "/quotes/42/estimate", body: { lengthM: 2, widthM: 2 } }),
    request({ method: "PATCH", path: `/quote/${token}`, body: { title: "privileged" } }),
    request({ method: "PATCH", path: `/quote/${token}`, body: { deckBoardType: "treated_pine", title: "smuggled" } }),
    request({ method: "PATCH", path: `/quote/${token}/status`, body: { status: "rejected" } }),
    request({ method: "PATCH", path: `/quote/${token}/status`, body: { status: "accepted", clerkUserId: "user_a" } }),
  ];
  for (const req of denied) assert.equal(invoke(req).statusCode, 401, `${req.method} ${req.path}`);
});

test("isolated two-user fixtures reject foreign, null-owned, and nested records", () => {
  const records = [
    { id: 1, clerkUserId: "user_a" },
    { id: 2, clerkUserId: "user_b" },
    { id: 3, clerkUserId: null },
  ];
  const owned = (userId, id) => records.find((record) => record.id === id && record.clerkUserId === userId);
  assert.equal(owned("user_a", 1)?.id, 1);
  assert.equal(owned("user_a", 2), undefined);
  assert.equal(owned("user_a", 3), undefined);

  const bookings = [{ id: 10, clerkUserId: "user_a" }, { id: 11, clerkUserId: "user_b" }];
  const members = [{ id: 20, clerkUserId: "user_a" }, { id: 21, clerkUserId: "user_b" }];
  const entries = [{ id: 30, jobId: 10, teamMemberId: 20 }, { id: 31, jobId: 11, teamMemberId: 21 }];
  const visibleEntries = (userId) => entries.filter((entry) =>
    bookings.some((booking) => booking.id === entry.jobId && booking.clerkUserId === userId) &&
    members.some((member) => member.id === entry.teamMemberId && member.clerkUserId === userId),
  );
  assert.deepEqual(visibleEntries("user_a").map((entry) => entry.id), [30]);
  assert.deepEqual(visibleEntries("user_b").map((entry) => entry.id), [31]);
});