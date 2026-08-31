import express from "express";
import router from "../src/routes";
import { pool } from "@workspace/db";

const app = express();
app.use(express.json());

// Test-only identity adapter. The esbuild test bundle replaces Clerk's getAuth
// with an implementation that reads this context; production does not import
// this entry point or honor this header.
app.use((req, _res, next) => {
  const userId = req.header("x-isolation-test-user");
  if (userId) req.clerkUserId = userId;
  next();
});
app.use(router);

export { app, pool };