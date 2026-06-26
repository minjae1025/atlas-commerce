import { NotFoundError } from "@atlas/shared";
import type { PaymentAttempt, PaymentIntent } from "../types.js";
import type { ListResult, Page } from "./pagination.js";

export interface IntentListFilter {
  status?: PaymentIntent["status"];
  orderId?: string;
  currency?: string;
}

export interface AttemptSummary {
  totalAttempts: number;
  succeededAttempts: number;
  failedAttempts: number;
  lastProviderRef: string | null;
  lastAttemptAt: string | null;
}

export interface CaptureSummary {
  intentId: string;
  status: PaymentIntent["status"];
  amountCents: number;
  capturedCents: number;
  remainingCents: number;
  attempts: AttemptSummary;
}

export interface PaymentIntentQueries {
  list(filter: IntentListFilter, page: Page): Promise<ListResult<PaymentIntent>>;
  findById(id: string): Promise<PaymentIntent | null>;
}

export interface PaymentAttemptQueries {
  listByIntent(intentId: string, page: Page): Promise<ListResult<PaymentAttempt>>;
  summarizeByIntent(intentId: string): Promise<AttemptSummary>;
}

export function paymentReadService(
  intents: PaymentIntentQueries,
  attempts: PaymentAttemptQueries,
) {
  return {
    listIntents(filter: IntentListFilter, page: Page): Promise<ListResult<PaymentIntent>> {
      return intents.list(filter, page);
    },

    async listAttempts(intentId: string, page: Page): Promise<ListResult<PaymentAttempt>> {
      const intent = await intents.findById(intentId);
      if (!intent) throw new NotFoundError("payment intent not found");
      return attempts.listByIntent(intentId, page);
    },

    async getCaptureSummary(intentId: string): Promise<CaptureSummary> {
      const intent = await intents.findById(intentId);
      if (!intent) throw new NotFoundError("payment intent not found");
      const summary = await attempts.summarizeByIntent(intentId);
      const capturedCents = intent.status === "succeeded" ? intent.amountCents : 0;
      return {
        intentId: intent.id,
        status: intent.status,
        amountCents: intent.amountCents,
        capturedCents,
        remainingCents: intent.amountCents - capturedCents,
        attempts: summary,
      };
    },
  };
}

export type PaymentReadService = ReturnType<typeof paymentReadService>;
