import type { Request, Response } from "express";
import type { ReturnServiceDeps } from "../domain/returnService.js";
import type { ReturnListFilter } from "../repositories/returnsRepo.js";
import {
  approveReturnRequest,
  createReturnRequest,
  getReturnRequest,
  listReturnRequests,
  rejectReturnRequest
} from "../domain/returnService.js";
import { presentReturn } from "../domain/models.js";
import { parseBody, parseParams, parseQuery } from "./parse.js";
import {
  createReturnBodySchema,
  listReturnsQuerySchema,
  rejectReturnBodySchema,
  returnIdParamsSchema
} from "./schemas.js";

const contextFromRequest = (req: Request) => {
  const requestId = req.id ?? req.header("x-request-id");
  return requestId ? { requestId } : {};
};

export function returnsController(deps: ReturnServiceDeps) {
  return {
    async create(req: Request, res: Response) {
      const body = parseBody(createReturnBodySchema, req);
      const request = await createReturnRequest(deps, body, contextFromRequest(req));
      res.status(201).json(presentReturn(request));
    },

    async get(req: Request, res: Response) {
      const params = parseParams(returnIdParamsSchema, req);
      const request = await getReturnRequest(deps, params.id);
      res.status(200).json(presentReturn(request));
    },

    async list(req: Request, res: Response) {
      const query = parseQuery(listReturnsQuerySchema, req);
      const filter: ReturnListFilter = {};
      if (query.orderId) filter.orderId = query.orderId;
      if (query.customerId) filter.customerId = query.customerId;
      if (query.status) filter.status = query.status;
      const result = await listReturnRequests(
        deps,
        filter,
        { limit: query.limit, offset: query.offset }
      );
      res.status(200).json({
        items: result.items.map(presentReturn),
        total: result.total
      });
    },

    async approve(req: Request, res: Response) {
      const params = parseParams(returnIdParamsSchema, req);
      const request = await approveReturnRequest(deps, params.id, contextFromRequest(req));
      res.status(200).json(presentReturn(request));
    },

    async reject(req: Request, res: Response) {
      const params = parseParams(returnIdParamsSchema, req);
      const body = parseBody(rejectReturnBodySchema, req);
      const request = await rejectReturnRequest(deps, params.id, body.reason);
      res.status(200).json(presentReturn(request));
    }
  };
}
