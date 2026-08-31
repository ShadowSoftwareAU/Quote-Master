import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";

let tempDir;
let buildClerkPublicMetadata;
let CreateOnboardingProfileBody;
let UpdateProfileSettingsBody;

before(async () => {
  tempDir = await mkdtemp(path.join(os.tmpdir(), "profile-regression-"));
  await build({
    entryPoints: [path.resolve("src/services/businessProfiles.ts")],
    outfile: path.join(tempDir, "business-profiles.mjs"),
    bundle: true,
    platform: "node",
    format: "esm",
    plugins: [{
      name: "fixture-clerk-and-db",
      setup(buildContext) {
        buildContext.onResolve({ filter: /^@clerk\/express$/ }, () => ({
          path: "fixture-clerk",
          namespace: "fixture",
        }));
        buildContext.onResolve({ filter: /^@workspace\/db$/ }, () => ({
          path: "fixture-db",
          namespace: "fixture",
        }));
        buildContext.onLoad({ filter: /fixture-clerk/, namespace: "fixture" }, () => ({
          contents: "export const clerkClient = { users: {} };",
          loader: "js",
        }));
        buildContext.onLoad({ filter: /fixture-db/, namespace: "fixture" }, () => ({
          contents: `
            export const businessProfilesTable = {};
            export const profileMetadataOutboxTable = {};
            export const db = {};
          `,
          loader: "js",
        }));
      },
    }],
  });
  await build({
    entryPoints: [path.resolve("../../lib/api-zod/src/generated/api.ts")],
    outfile: path.join(tempDir, "api-zod.mjs"),
    bundle: true,
    platform: "node",
    format: "esm",
  });
  ({ buildClerkPublicMetadata } = await import(
    pathToFileURL(path.join(tempDir, "business-profiles.mjs")).href
  ));
  ({ CreateOnboardingProfileBody, UpdateProfileSettingsBody } = await import(
    pathToFileURL(path.join(tempDir, "api-zod.mjs")).href
  ));
});

after(async () => {
  if (tempDir) await rm(tempDir, { recursive: true, force: true });
});

test("onboarding accepts AU business details and rejects malformed contact data", () => {
  const valid = CreateOnboardingProfileBody.safeParse({
    businessName: "Northside Carpentry Pty Ltd",
    phoneNumber: "+61 412 345 678",
    tradeType: "Carpenter",
    licenseNumber: "QBCC 1234567",
    role: "Owner",
  });
  assert.equal(valid.success, true);

  const malformed = CreateOnboardingProfileBody.safeParse({
    businessName: "Northside Carpentry Pty Ltd",
    phoneNumber: "call-me",
    tradeType: "Carpenter",
    role: "Owner",
  });
  assert.equal(malformed.success, false);
});

test("profile settings restrict role and licence formats", () => {
  assert.equal(UpdateProfileSettingsBody.safeParse({
    tradeType: "Builder",
    role: "Subcontractor",
    licenseNumber: "NSW 123C",
  }).success, true);
  assert.equal(UpdateProfileSettingsBody.safeParse({
    tradeType: "Builder",
    role: "Administrator",
  }).success, false);
  assert.equal(UpdateProfileSettingsBody.safeParse({
    tradeType: "Builder",
    role: "Owner",
    licenseNumber: "<script>",
  }).success, false);
});

test("business role metadata preserves privileged access separately", () => {
  assert.deepEqual(
    buildClerkPublicMetadata(
      { role: "MASTER_BUILDER", unrelated: "keep" },
      "Owner",
      "Builder",
    ),
    {
      role: "Owner",
      accessRole: "MASTER_BUILDER",
      tradeType: "Builder",
      unrelated: "keep",
    },
  );
});