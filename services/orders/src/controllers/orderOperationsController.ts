import type { RequestHandler } from "express";
import type { OrderOperationsService } from "../domain/orderOperationsService.js";
import type { AddOrderNoteInput, OrderExportQuery } from "../domain/orderOperationsTypes.js";
import { parseBody, parseParams, parseQuery } from "./parse.js";
import {
  addOrderNoteBodySchema,
  orderExportQuerySchema,
  orderNoteParamsSchema,
  shipmentSlaQuerySchema
} from "./orderOperationsSchemas.js";

export const addOrderNoteController = (service: OrderOperationsService): RequestHandler => {
  return async (req, res, next) => {
    try {
      const params = parseParams(orderNoteParamsSchema, req);
      const body = parseBody(addOrderNoteBodySchema, req);
      const input: AddOrderNoteInput = {
        orderId: params.id,
        author: body.author,
        body: body.body,
        visibility: body.visibility ?? "internal"
      };
      if (body.noteId !== undefined) {
        input.noteId = body.noteId;
      }
      res.status(201).json(await service.addNote(input));
    } catch (err) {
      next(err);
    }
  };
};

export const exportOrdersController = (service: OrderOperationsService): RequestHandler => {
  return async (req, res, next) => {
    try {
      const query = parseQuery(orderExportQuerySchema, req);
      const input: OrderExportQuery = {
        format: query.format ?? "json",
        limit: query.limit ?? 100,
        offset: query.offset ?? 0
      };
      if (query.customerId !== undefined) {
        input.customerId = query.customerId;
      }
      if (query.status !== undefined) {
        input.status = query.status;
      }
      if (query.placedFrom !== undefined) {
        input.placedFrom = query.placedFrom;
      }
      if (query.placedTo !== undefined) {
        input.placedTo = query.placedTo;
      }
      res.json(await service.exportOrders(input));
    } catch (err) {
      next(err);
    }
  };
};

export const shipmentSlaController = (service: OrderOperationsService): RequestHandler => {
  return async (req, res, next) => {
    try {
      const query = parseQuery(shipmentSlaQuerySchema, req);
      res.json(await service.shipmentSla(query));
    } catch (err) {
      next(err);
    }
  };
};
