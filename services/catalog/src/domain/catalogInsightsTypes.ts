import type { Currency } from "./currency.js";
import type { CustomerTier, Product, ProductStatus } from "./types.js";

export interface ProductSearchQuery {
  q?: string;
  categoryId?: string;
  status?: ProductStatus;
  sku?: string;
  minPriceCents?: number;
  maxPriceCents?: number;
  sort: "relevance" | "price_asc" | "price_desc" | "updated_desc";
  limit: number;
  offset: number;
}

export interface ProductSearchHit {
  product: Product;
  score: number;
  matchedFields: string[];
}

export interface ProductSearchResult {
  items: ProductSearchHit[];
  total: number;
  facets: {
    status: Record<ProductStatus, number>;
    categoryIds: Record<string, number>;
  };
}

export interface CategoryTreeNode {
  id: string;
  name: string;
  parentId: string | null;
  children: CategoryTreeNode[];
}

export interface PriceHistoryQuery {
  productId: string;
  customerTier: CustomerTier;
  currency?: Currency;
  qty: number;
  requestId?: string;
}

export interface PriceObservation {
  observedAt: string;
  source: "base_price" | "current_price";
  currency: Currency;
  unitPriceCents: number;
  appliedRuleIds: string[];
}

export interface PriceHistoryResult {
  productId: string;
  observations: PriceObservation[];
}
