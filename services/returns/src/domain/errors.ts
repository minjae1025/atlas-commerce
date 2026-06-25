import { AppError } from "@atlas/shared";

export const returnsError = (
  code: string,
  message: string,
  status: number,
  ctx?: object
): AppError => new AppError(code, status, message, ctx);

export const returnsValidationError = (
  code: string,
  message: string,
  ctx?: object
): AppError => returnsError(code, message, 422, ctx);

export const returnNotFoundError = (returnId: string): AppError =>
  returnsError("RETURN_NOT_FOUND", "Return request was not found", 404, { returnId });

export const returnConflictError = (
  code: string,
  message: string,
  ctx?: object
): AppError => returnsError(code, message, 409, ctx);

export const returnUpstreamError = (
  code: string,
  message: string,
  ctx?: object
): AppError => returnsError(code, message, 502, ctx);
