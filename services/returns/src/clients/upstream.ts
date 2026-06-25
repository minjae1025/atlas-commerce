import { UpstreamError, type Logger } from "@atlas/shared";
import type { RequestContext } from "../domain/models.js";

export const isUpstreamError = (err: unknown): err is UpstreamError =>
  err instanceof UpstreamError ||
  (typeof err === "object" &&
    err !== null &&
    "status" in err &&
    "body" in err &&
    (err as { name?: unknown }).name === "UpstreamError");

export const warnAndRethrow = (
  err: UpstreamError,
  logger: Logger,
  service: string,
  operation: string,
  ctx: RequestContext
): never => {
  logger.warn(`${service} ${operation} failed`, {
    ...ctx,
    status: err.status,
    body: err.body
  });
  throw err;
};
