export interface TransferStockInput {
  transferId?: string;
  sourceWarehouseId: string;
  destinationWarehouseId: string;
  productId: string;
  qty: number;
  reason: string;
}

export interface TransferStockResult {
  transferId: string;
  productId: string;
  qty: number;
  sourceWarehouseId: string;
  destinationWarehouseId: string;
  sourceOnHand: number;
  destinationOnHand: number;
  movementIds: string[];
  replayed: boolean;
}

export interface LowStockQuery {
  warehouseId?: string;
  threshold: number;
  limit: number;
  offset: number;
}

export interface LowStockItem {
  productId: string;
  warehouseId: string;
  warehouseCode: string;
  onHand: number;
  reserved: number;
  available: number;
  threshold: number;
}

export interface LowStockResult {
  items: LowStockItem[];
  total: number;
}

export interface CycleCountInput {
  cycleCountId?: string;
  warehouseId: string;
  productId: string;
  countedOnHand: number;
  countedBy: string;
  reason: string;
}

export interface CycleCountResult {
  cycleCountId: string;
  warehouseId: string;
  productId: string;
  previousOnHand: number;
  countedOnHand: number;
  delta: number;
  reserved: number;
  movementId: string;
  replayed: boolean;
}
