import type { Logger } from "@atlas/shared";
import type { JsonObject } from "./types.js";

export type AlertKind =
  | "inventory_consistency"
  | "order_amount_anomaly"
  | "price_consistency"
  | "settlement_reconciliation"
  | "http_error";

export type AlertEmitter = {
  emit(kind: AlertKind, fields: JsonObject): void;
};

export const createAlertEmitter = (logger: Logger): AlertEmitter => ({
  emit(kind, fields) {
    logger.error(`ALERT ${kind} ${JSON.stringify(fields)}`, { kind, ...fields });
  }
});
