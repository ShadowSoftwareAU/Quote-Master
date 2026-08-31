import { logger } from "../lib/logger";
import { processDueProfileMetadataJobs } from "./businessProfiles";

const RETRY_INTERVAL_MS = 30_000;

export function startProfileMetadataWorker(): NodeJS.Timeout {
  const run = () => {
    processDueProfileMetadataJobs().catch((error) => {
      logger.error({ err: error }, "Profile metadata retry worker failed");
    });
  };
  run();
  const timer = setInterval(run, RETRY_INTERVAL_MS);
  timer.unref();
  return timer;
}