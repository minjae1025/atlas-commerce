import type { Logger } from "@atlas/shared";
import type { CatalogInsightsRepository } from "../repositories/catalogInsightsRepository.js";
import type { Category, PriceRequest, Product, ProductListFilters } from "./types.js";
import type {
  CategoryTreeNode,
  PriceHistoryQuery,
  PriceHistoryResult,
  ProductSearchHit,
  ProductSearchQuery,
  ProductSearchResult
} from "./catalogInsightsTypes.js";

const CATEGORY_TREE_SCAN_LIMIT = 1000;

export class CatalogInsightsService {
  constructor(
    private readonly repository: CatalogInsightsRepository,
    private readonly logger: Logger
  ) {}

  async searchProducts(query: ProductSearchQuery): Promise<ProductSearchResult> {
    try {
      const filters: ProductListFilters = {};
      if (query.categoryId) {
        filters.categoryId = query.categoryId;
      }
      if (query.status) {
        filters.status = query.status;
      }
      if (query.sku) {
        filters.sku = query.sku;
      }

      const firstPage = await this.repository.listProducts(filters, { limit: 1, offset: 0 });
      const loaded =
        firstPage.total <= firstPage.items.length
          ? firstPage
          : await this.repository.listProducts(filters, { limit: firstPage.total, offset: 0 });
      const hits = rankProducts(loaded.items, query);
      const sorted = sortHits(hits, query.sort);

      return {
        items: sorted.slice(query.offset, query.offset + query.limit),
        total: sorted.length,
        facets: buildFacets(sorted.map((hit) => hit.product))
      };
    } catch (error) {
      this.logger.warn("catalog product search failed", {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  async listCategoryTree(): Promise<CategoryTreeNode[]> {
    try {
      const categories = await this.repository.listCategories({
        limit: CATEGORY_TREE_SCAN_LIMIT,
        offset: 0
      });
      return buildCategoryTree(categories.items);
    } catch (error) {
      this.logger.warn("catalog category tree failed", {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  async getPriceHistory(query: PriceHistoryQuery): Promise<PriceHistoryResult> {
    try {
      const product = await this.repository.getProduct(query.productId);
      const priceRequest: PriceRequest = {
        productId: query.productId,
        customerTier: query.customerTier,
        qty: query.qty
      };
      if (query.currency !== undefined) {
        priceRequest.currency = query.currency;
      }
      if (query.requestId !== undefined) {
        priceRequest.requestId = query.requestId;
      }
      const current = await this.repository.getPrice(priceRequest);

      const observations = [
        {
          observedAt: product.createdAt,
          source: "base_price" as const,
          currency: product.currency,
          unitPriceCents: product.basePriceCents,
          appliedRuleIds: []
        },
        {
          observedAt: product.updatedAt,
          source: "current_price" as const,
          currency: current.currency,
          unitPriceCents: current.unitPriceCents,
          appliedRuleIds: current.appliedRuleIds
        }
      ];

      return {
        productId: product.id,
        observations: observations.sort((a, b) => a.observedAt.localeCompare(b.observedAt))
      };
    } catch (error) {
      this.logger.warn("catalog price history failed", {
        productId: query.productId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }
}

export function rankProducts(products: Product[], query: ProductSearchQuery): ProductSearchHit[] {
  const terms = query.q?.toLocaleLowerCase().split(/\s+/).filter(Boolean) ?? [];
  const minPrice = query.minPriceCents ?? 0;
  const maxPrice = query.maxPriceCents ?? Number.MAX_SAFE_INTEGER;

  return products.flatMap((product) => {
    if (product.basePriceCents < minPrice || product.basePriceCents > maxPrice) {
      return [];
    }

    const matchedFields = new Set<string>();
    let score = 0;
    const sku = product.sku.toLocaleLowerCase();
    const name = product.name.toLocaleLowerCase();
    const description = product.description.toLocaleLowerCase();

    for (const term of terms) {
      if (sku.includes(term)) {
        matchedFields.add("sku");
        score += 8;
      }
      if (name.includes(term)) {
        matchedFields.add("name");
        score += 5;
      }
      if (description.includes(term)) {
        matchedFields.add("description");
        score += 2;
      }
    }

    if (terms.length > 0 && score === 0) {
      return [];
    }

    return [
      {
        product,
        score,
        matchedFields: [...matchedFields].sort()
      }
    ];
  });
}

export function buildCategoryTree(categories: Category[]): CategoryTreeNode[] {
  const nodes = new Map<string, CategoryTreeNode>();
  for (const category of categories) {
    nodes.set(category.id, { ...category, children: [] });
  }

  const roots: CategoryTreeNode[] = [];
  for (const category of categories) {
    const node = nodes.get(category.id);
    if (!node) {
      continue;
    }

    if (category.parentId && nodes.has(category.parentId)) {
      nodes.get(category.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  const byName = (a: CategoryTreeNode, b: CategoryTreeNode) => a.name.localeCompare(b.name);
  for (const node of nodes.values()) {
    node.children.sort(byName);
  }
  return roots.sort(byName);
}

function sortHits(hits: ProductSearchHit[], sort: ProductSearchQuery["sort"]): ProductSearchHit[] {
  const sorted = [...hits];
  if (sort === "price_asc") {
    return sorted.sort((a, b) => a.product.basePriceCents - b.product.basePriceCents || a.product.id.localeCompare(b.product.id));
  }
  if (sort === "price_desc") {
    return sorted.sort((a, b) => b.product.basePriceCents - a.product.basePriceCents || a.product.id.localeCompare(b.product.id));
  }
  if (sort === "updated_desc") {
    return sorted.sort((a, b) => b.product.updatedAt.localeCompare(a.product.updatedAt) || a.product.id.localeCompare(b.product.id));
  }
  return sorted.sort((a, b) => b.score - a.score || a.product.name.localeCompare(b.product.name));
}

function buildFacets(products: Product[]): ProductSearchResult["facets"] {
  const status: ProductSearchResult["facets"]["status"] = {
    active: 0,
    discontinued: 0
  };
  const categoryIds: Record<string, number> = {};

  for (const product of products) {
    status[product.status] += 1;
    categoryIds[product.categoryId] = (categoryIds[product.categoryId] ?? 0) + 1;
  }

  return { status, categoryIds };
}
