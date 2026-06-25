import { NotFoundError } from "@atlas/shared";
import type { LedgerEntry } from "../repositories/ledgerRepo.js";
import type { Settlement, SettlementsRepo } from "../repositories/settlementsRepo.js";
import type { ListResult, Page } from "./pagination.js";

export interface SettlementLineDetail {
  id: string;
  settlementId: string;
  ledgerEntry: LedgerEntry;
}

export interface SettlementLinesRepo {
  listBySettlement(settlementId: string, page: Page): Promise<ListResult<SettlementLineDetail>>;
  findLine(settlementId: string, lineId: string): Promise<SettlementLineDetail | null>;
}

export function settlementReadService(
  settlements: Pick<SettlementsRepo, "findById">,
  lines: SettlementLinesRepo,
) {
  async function requireSettlement(settlementId: string): Promise<Settlement> {
    const settlement = await settlements.findById(settlementId);
    if (!settlement) throw new NotFoundError("settlement not found");
    return settlement;
  }

  return {
    async listLines(settlementId: string, page: Page): Promise<ListResult<SettlementLineDetail>> {
      await requireSettlement(settlementId);
      return lines.listBySettlement(settlementId, page);
    },

    async getLine(settlementId: string, lineId: string): Promise<SettlementLineDetail> {
      await requireSettlement(settlementId);
      const line = await lines.findLine(settlementId, lineId);
      if (!line) throw new NotFoundError("settlement line not found");
      return line;
    },
  };
}

export type SettlementReadService = ReturnType<typeof settlementReadService>;
