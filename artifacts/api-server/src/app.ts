import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { clerkMiddleware } from "@clerk/express";
import router from "./routes";
import { logger } from "./lib/logger";
import { requireApiAuth } from "./middlewares/apiAuth";

const app: Express = express();
const QUOTE_PORTAL_TOKEN_IN_PATH = /\/api\/quote\/[A-Za-z0-9_-]{43}/g;
const MASTER_PROJECT_PORTAL_TOKEN_IN_PATH = /\/api\/master-project\/[A-Za-z0-9_-]{43}/g;

function requestPathForLogs(url: string | undefined): string | undefined {
  return url
    ?.split("?")[0]
    .replace(QUOTE_PORTAL_TOKEN_IN_PATH, "/api/quote/[REDACTED]")
    .replace(MASTER_PROJECT_PORTAL_TOKEN_IN_PATH, "/api/master-project/[REDACTED]");
}

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
            url: requestPathForLogs(req.url),
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
const clerkSecretKey = process.env.CLERK_SECRET_KEY;
const clerkPublishableKey = process.env.CLERK_PUBLISHABLE_KEY;
if (clerkSecretKey && clerkPublishableKey) {
  app.use(
    clerkMiddleware({
      secretKey: clerkSecretKey,
      publishableKey: clerkPublishableKey,
    }),
  );
}
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", requireApiAuth);
app.use("/api", router);

export default app;
