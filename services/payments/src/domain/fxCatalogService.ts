import type { Cache } from "@atlas/shared";
import type { FxRate } from "../types.js";
import type { ListResult, Page } from "./pagination.js";

const FX_LIST_TTL_SEC = 300;

export interface FxListFilter {
  base?: string;
  quote?: string;
}

export interface FxCatalogRepo {
  list(filter: FxListFilter, page: Page): Promise<ListResult<FxRate>>;
}

export function fxCatalogService(fx: FxCatalogRepo, cache: Cache) {
  return {
    listRates(filter: FxListFilter, page: Page): Promise<ListResult<FxRate>> {
      const key = [
        "payments:fx:list",
        filter.base ?? "*",
        filter.quote ?? "*",
        page.limit,
        page.offset,
      ].join(":");
      return cache.withCache(key, FX_LIST_TTL_SEC, () => fx.list(filter, page));
    },
  };
}

export type FxCatalogService = ReturnType<typeof fxCatalogService>;
