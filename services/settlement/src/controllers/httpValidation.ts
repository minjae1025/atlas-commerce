import type { Request } from "express";
import { z, type ZodTypeAny } from "zod";
import { ValidationError } from "@atlas/shared";

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

function isValidCalendarDate(value: string): boolean {
  if (!DATE_ONLY_RE.test(value)) {
    return false;
  }
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export const dateOnlySchema = z.string()
  .regex(DATE_ONLY_RE, "date must be YYYY-MM-DD")
  .refine(isValidCalendarDate, "date must be a valid calendar date");

export const paginationQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export function parseParams<T extends ZodTypeAny>(schema: T, req: Request): z.infer<T> {
  const parsed = schema.safeParse(req.params);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues.map((issue) => issue.message).join("; "));
  }
  return parsed.data;
}

export function parseQuery<T extends ZodTypeAny>(schema: T, req: Request): z.infer<T> {
  const parsed = schema.safeParse(req.query);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues.map((issue) => issue.message).join("; "));
  }
  return parsed.data;
}
