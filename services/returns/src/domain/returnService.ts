import type { Idempotency } from "@atlas/shared";
import type { InventoryClient } from "../clients/inventoryClient.js";
import { chooseRestockWarehouse } from "../clients/inventoryClient.js";
import type { OrdersClient } from "../clients/ordersClient.js";
import type { SettlementClient } from "../clients/settlementClient.js";
import type { ReturnsRepo, ReturnListFilter } from "../repositories/returnsRepo.js";
import {
  returnConflictError
} from "./errors.js";
import {
  assertOrderRefundable,
  calculateRefundLines
} from "./refundCalculator.js";
import type {
  CreateReturnInput,
  ListResult,
  Page,
  RequestContext,
  ReturnRequest
} from "./models.js";

const IDEMPOTENCY_TTL_SEC = 86_400;

export interface ReturnServiceDeps {
  returns: ReturnsRepo;
  orders: OrdersClient;
  inventory: InventoryClient;
  settlement: SettlementClient;
  idempotency: Idempotency;
}

export async function createReturnRequest(
  deps: ReturnServiceDeps,
  input: CreateReturnInput,
  ctx: RequestContext
): Promise<ReturnRequest> {
  const order = await deps.orders.getOrder(input.orderId, ctx);
  assertOrderRefundable(order);
  const calculated = calculateRefundLines(order, input.lines);

  return deps.returns.create({
    orderId: order.id,
    customerId: order.customerId,
    reason: input.reason,
    totalRefundCents: calculated.totalRefundCents,
    currency: order.currency,
    lines: calculated.lines
  });
}

export async function getReturnRequest(
  deps: Pick<ReturnServiceDeps, "returns">,
  returnId: string
): Promise<ReturnRequest> {
  return deps.returns.findByIdOrThrow(returnId);
}

export async function listReturnRequests(
  deps: Pick<ReturnServiceDeps, "returns">,
  filter: ReturnListFilter,
  page: Page
): Promise<ListResult<ReturnRequest>> {
  return deps.returns.list(filter, page);
}

export async function approveReturnRequest(
  deps: ReturnServiceDeps,
  returnId: string,
  ctx: RequestContext
): Promise<ReturnRequest> {
  const { result } = await deps.idempotency.run(
    `returns:approve:${returnId}`,
    IDEMPOTENCY_TTL_SEC,
    () => approveReturnOnce(deps, returnId, ctx)
  );
  return result;
}

async function approveReturnOnce(
  deps: ReturnServiceDeps,
  returnId: string,
  ctx: RequestContext
): Promise<ReturnRequest> {
  let request = await deps.returns.findByIdOrThrow(returnId);
  if (request.status === "refunded") {
    return request;
  }
  if (request.status === "rejected") {
    throw returnConflictError("RETURN_ALREADY_REJECTED", "Rejected returns cannot be approved", {
      returnId
    });
  }
  if (request.status === "requested") {
    request = await deps.returns.markApproved(returnId);
  }

  const approveCtx = { ...ctx, returnId, orderId: request.orderId, customerId: request.customerId };
  if (request.inventoryRestoredAt === null) {
    for (const line of request.lines) {
      const stock = await deps.inventory.getStock(line.productId, approveCtx);
      await deps.inventory.createAdjustment(
        {
          warehouseId: chooseRestockWarehouse(stock),
          productId: line.productId,
          delta: line.qty,
          reason: "return"
        },
        approveCtx
      );
    }
    request = await deps.returns.markInventoryRestored(returnId);
  }

  if (request.ledgerRecordedAt === null) {
    await deps.settlement.postLedgerEntry(
      {
        account: "refunds",
        orderId: request.orderId,
        amountCents: request.totalRefundCents,
        currency: request.currency,
        entryType: "refund",
        externalRef: request.id
      },
      approveCtx
    );
    request = await deps.returns.markLedgerRecorded(returnId);
  }

  if (request.status === "refunded") {
    return request;
  }
  return deps.returns.markRefunded(returnId);
}

export async function rejectReturnRequest(
  deps: Pick<ReturnServiceDeps, "returns">,
  returnId: string,
  reason?: string
): Promise<ReturnRequest> {
  const request = await deps.returns.findByIdOrThrow(returnId);
  if (request.status !== "requested") {
    throw returnConflictError("RETURN_STATUS_CONFLICT", "Only requested returns can be rejected", {
      returnId,
      status: request.status
    });
  }
  return deps.returns.markRejected(returnId, reason);
}
