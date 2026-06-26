import type { Db } from "@atlas/shared";
import type {
  CycleCountInput,
  CycleCountResult,
  LowStockItem,
  LowStockQuery,
  LowStockResult,
  TransferStockInput,
  TransferStockResult
} from "../domain/stockOperationsTypes.js";

interface StockLevelMutationRow {
  warehouseId: string;
  productId: string;
  onHand: number;
  reserved: number;
}

interface MovementIdRow {
  id: string;
}

interface CountRow {
  total: string | number;
}

interface LowStockRow {
  productId: string;
  warehouseId: string;
  warehouseCode: string;
  onHand: number;
  reserved: number;
  available: number;
}

export class StockOperationsRepository {
  constructor(private readonly db: Db) {}

  async transferStock(
    input: Required<TransferStockInput>,
    movementIds: { source: string; destination: string }
  ): Promise<TransferStockResult | null> {
    return this.db.withTx(async (tx) => {
      const sourceRows = await tx.query<StockLevelMutationRow>(
        `
        update stock_levels
        set on_hand = on_hand - $3,
            updated_at = now()
        where warehouse_id = $1
          and product_id = $2
          and on_hand >= $3
        returning
          warehouse_id as "warehouseId",
          product_id as "productId",
          on_hand as "onHand",
          reserved
        `,
        [input.sourceWarehouseId, input.productId, input.qty]
      );

      const source = sourceRows[0];
      if (!source) {
        return null;
      }

      const destinationRows = await tx.query<StockLevelMutationRow>(
        `
        insert into stock_levels (warehouse_id, product_id, on_hand, reserved, updated_at)
        values ($1, $2, $3, 0, now())
        on conflict (warehouse_id, product_id)
        do update set on_hand = stock_levels.on_hand + excluded.on_hand,
                      updated_at = now()
        returning
          warehouse_id as "warehouseId",
          product_id as "productId",
          on_hand as "onHand",
          reserved
        `,
        [input.destinationWarehouseId, input.productId, input.qty]
      );
      const destination = destinationRows[0]!;

      const sourceMovement = await tx.query<MovementIdRow>(
        `
        insert into stock_movements (id, warehouse_id, product_id, delta, reason, ref_type, ref_id, created_at)
        values ($1, $2, $3, $4, $5, 'transfer', $6, now())
        returning id
        `,
        [
          movementIds.source,
          input.sourceWarehouseId,
          input.productId,
          -input.qty,
          input.reason,
          input.transferId
        ]
      );
      const destinationMovement = await tx.query<MovementIdRow>(
        `
        insert into stock_movements (id, warehouse_id, product_id, delta, reason, ref_type, ref_id, created_at)
        values ($1, $2, $3, $4, $5, 'transfer', $6, now())
        returning id
        `,
        [
          movementIds.destination,
          input.destinationWarehouseId,
          input.productId,
          input.qty,
          input.reason,
          input.transferId
        ]
      );

      return {
        transferId: input.transferId,
        productId: input.productId,
        qty: input.qty,
        sourceWarehouseId: input.sourceWarehouseId,
        destinationWarehouseId: input.destinationWarehouseId,
        sourceOnHand: source.onHand,
        destinationOnHand: destination.onHand,
        movementIds: [sourceMovement[0]!.id, destinationMovement[0]!.id],
        replayed: false
      };
    });
  }

  async listLowStock(query: LowStockQuery): Promise<LowStockResult> {
    const conditions = ["(sl.on_hand - sl.reserved) <= $1"];
    const params: unknown[] = [query.threshold];

    if (query.warehouseId) {
      params.push(query.warehouseId);
      conditions.push(`sl.warehouse_id = $${params.length}`);
    }

    const where = conditions.join(" and ");
    const countRows = await this.db.query<CountRow>(
      `
      select count(*)::int as total
      from stock_levels sl
      where ${where}
      `,
      params
    );

    const rows = await this.db.query<LowStockRow>(
      `
      select
        sl.product_id as "productId",
        sl.warehouse_id as "warehouseId",
        coalesce(w.code, sl.warehouse_id::text) as "warehouseCode",
        sl.on_hand as "onHand",
        sl.reserved,
        sl.on_hand - sl.reserved as available
      from stock_levels sl
      left join warehouses w on w.id = sl.warehouse_id
      where ${where}
      order by available asc, sl.product_id asc, sl.warehouse_id asc
      limit $${params.length + 1}
      offset $${params.length + 2}
      `,
      [...params, query.limit, query.offset]
    );

    return {
      items: rows.map((row) => ({ ...row, threshold: query.threshold })),
      total: Number(countRows[0]?.total ?? 0)
    };
  }

  async recordCycleCount(
    input: Required<CycleCountInput>,
    movementId: string
  ): Promise<CycleCountResult | null> {
    return this.db.withTx(async (tx) => {
      const currentRows = await tx.query<StockLevelMutationRow>(
        `
        select
          warehouse_id as "warehouseId",
          product_id as "productId",
          on_hand as "onHand",
          reserved
        from stock_levels
        where warehouse_id = $1
          and product_id = $2
        for update
        `,
        [input.warehouseId, input.productId]
      );
      const current = currentRows[0];
      if (!current || current.reserved > input.countedOnHand) {
        return null;
      }

      const delta = input.countedOnHand - current.onHand;
      const updatedRows = await tx.query<StockLevelMutationRow>(
        `
        update stock_levels
        set on_hand = $3,
            updated_at = now()
        where warehouse_id = $1
          and product_id = $2
          and reserved <= $3
        returning
          warehouse_id as "warehouseId",
          product_id as "productId",
          on_hand as "onHand",
          reserved
        `,
        [input.warehouseId, input.productId, input.countedOnHand]
      );
      const updated = updatedRows[0];
      if (!updated) {
        return null;
      }

      const movementRows = await tx.query<MovementIdRow>(
        `
        insert into stock_movements (id, warehouse_id, product_id, delta, reason, ref_type, ref_id, created_at)
        values ($1, $2, $3, $4, $5, 'cycle_count', $6, now())
        returning id
        `,
        [
          movementId,
          input.warehouseId,
          input.productId,
          delta,
          `${input.reason} (${input.countedBy})`,
          input.cycleCountId
        ]
      );

      return {
        cycleCountId: input.cycleCountId,
        warehouseId: input.warehouseId,
        productId: input.productId,
        previousOnHand: current.onHand,
        countedOnHand: updated.onHand,
        delta,
        reserved: updated.reserved,
        movementId: movementRows[0]!.id,
        replayed: false
      };
    });
  }
}
