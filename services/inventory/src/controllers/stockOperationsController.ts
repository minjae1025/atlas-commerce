import type { NextFunction, Request, Response } from "express";
import type { CycleCountInput, LowStockQuery, TransferStockInput } from "../domain/stockOperationsTypes.js";
import type { StockOperationsService } from "../domain/stockOperationsService.js";
import {
  cycleCountBodySchema,
  lowStockQuerySchema,
  transferStockBodySchema
} from "./stockOperationsSchemas.js";
import { parseRequest } from "./validation.js";

export const transferStockController = (service: StockOperationsService) => async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const body = parseRequest(transferStockBodySchema, req.body);
    const input: TransferStockInput = {
      sourceWarehouseId: body.sourceWarehouseId,
      destinationWarehouseId: body.destinationWarehouseId,
      productId: body.productId,
      qty: body.qty,
      reason: body.reason ?? "warehouse_transfer"
    };
    if (body.transferId !== undefined) {
      input.transferId = body.transferId;
    }
    res.status(201).json(await service.transferStock(input));
  } catch (err) {
    next(err);
  }
};

export const lowStockController = (service: StockOperationsService) => async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const query = parseRequest(lowStockQuerySchema, req.query);
    const input: LowStockQuery = {
      threshold: query.threshold ?? 10,
      limit: query.limit ?? 100,
      offset: query.offset ?? 0
    };
    if (query.warehouseId !== undefined) {
      input.warehouseId = query.warehouseId;
    }
    res.json(await service.listLowStock(input));
  } catch (err) {
    next(err);
  }
};

export const cycleCountController = (service: StockOperationsService) => async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const body = parseRequest(cycleCountBodySchema, req.body);
    const input: CycleCountInput = {
      warehouseId: body.warehouseId,
      productId: body.productId,
      countedOnHand: body.countedOnHand,
      countedBy: body.countedBy,
      reason: body.reason ?? "cycle_count"
    };
    if (body.cycleCountId !== undefined) {
      input.cycleCountId = body.cycleCountId;
    }
    res.status(201).json(await service.recordCycleCount(input));
  } catch (err) {
    next(err);
  }
};
