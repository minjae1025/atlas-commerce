import type { Request } from "express";
import { z, type ZodTypeAny } from "zod";
import { ValidationError } from "@atlas/shared";

export const paginationQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export function parseParams<T extends ZodTypeAny>(schema: T, req: Request): z.infer<T> {
  const parsed = schema.safeParse(req.params);
  if (!parsed.success) {
    const messages = parsed.error.issues.map(
      (issue) => `${issue.path.join(".")}: ${issue.message}`
    );
    throw new ValidationError(messages.join("; "));
  }
  return parsed.data;
}

export function parseQuery<T extends ZodTypeAny>(schema: T, req: Request): z.infer<T> {
  const parsed = schema.safeParse(req.query);
  if (!parsed.success) {
    const messages = parsed.error.issues.map(
      (issue) => `${issue.path.join(".")}: ${issue.message}`
    );
    throw new ValidationError(messages.join("; "));
  }
  return parsed.data;
}
