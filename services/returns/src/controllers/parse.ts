import type { Request } from "express";
import type { ZodTypeAny, z } from "zod";
import { returnsValidationError } from "../domain/errors.js";

const parse = <T extends ZodTypeAny>(schema: T, value: unknown, code: string): z.infer<T> => {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw returnsValidationError(code, "Request validation failed", {
      issues: result.error.issues
    });
  }
  return result.data;
};

export const parseBody = <T extends ZodTypeAny>(schema: T, req: Request): z.infer<T> =>
  parse(schema, req.body, "INVALID_REQUEST_BODY");

export const parseParams = <T extends ZodTypeAny>(schema: T, req: Request): z.infer<T> =>
  parse(schema, req.params, "INVALID_REQUEST_PARAMS");

export const parseQuery = <T extends ZodTypeAny>(schema: T, req: Request): z.infer<T> =>
  parse(schema, req.query, "INVALID_REQUEST_QUERY");
