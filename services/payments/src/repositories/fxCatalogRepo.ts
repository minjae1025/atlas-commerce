import type { Db } from "@atlas/shared";
import type { FxRate } from "../types.js";
import type { FxListFilter } from "../domain/fxCatalogService.js";
import type { ListResult, Page } from "../domain/pagination.js";

interface FxRow {
  base: string;
  quote: string;
  rate: string;
  fetched_at: Date;
}

function mapRate(row: FxRow): FxRate {
  return {
    base: row.base,
    quote: row.quote,
    rate: Number(row.rate),
    fetchedAt: row.fetched_at.toISOString(),
  };
}

export function fxCatalogRepo(db: Db) {
  return {
    async list(filter: FxListFilter, page: Page): Promise<ListResult<FxRate>> {
      const clauses: string[] = [];
      const params: unknown[] = [];

      if (filter.base !== undefined) {
        params.push(filter.base);
        clauses.push(`base = $${params.length}`);
      }
      if (filter.quote !== undefined) {
        params.push(filter.quote);
        clauses.push(`quote = $${params.length}`);
      }

      const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";

      const countRows = await db.query<{ total: string }>(
        `SELECT COUNT(*)::text AS total
           FROM payments.fx_rates
          ${where}`,
        params,
      );

      const limitParam = params.length + 1;
      const offsetParam = params.length + 2;
      const rows = await db.query<FxRow>(
        `SELECT base, quote, rate, fetched_at
           FROM payments.fx_rates
          ${where}
          ORDER BY base, quote
          LIMIT $${limitParam} OFFSET $${offsetParam}`,
        [...params, page.limit, page.offset],
      );
      return {
        items: rows.map(mapRate),
        total: Number(countRows[0]?.total ?? 0),
      };
    },
  };
}

export type FxCatalogRepoImpl = ReturnType<typeof fxCatalogRepo>;
