import type { CategoryService } from "../domain/categoryService.js";
import type { PriceService } from "../domain/priceService.js";
import type { ProductService } from "../domain/productService.js";
import type { Category, ComputedPrice, PriceRequest, Product, ProductListFilters } from "../domain/types.js";
import type { Pagination } from "../domain/types.js";
import type { ListResult } from "../domain/listResult.js";

export interface CatalogInsightsRepositoryDeps {
  products: ProductService;
  categories: CategoryService;
  prices: PriceService;
}

export class CatalogInsightsRepository {
  constructor(private readonly deps: CatalogInsightsRepositoryDeps) {}

  async listProducts(filters: ProductListFilters, pagination: Pagination): Promise<ListResult<Product>> {
    return this.deps.products.listProducts(filters, pagination);
  }

  async getProduct(productId: string): Promise<Product> {
    return this.deps.products.getProductById(productId);
  }

  async listCategories(pagination: Pagination): Promise<ListResult<Category>> {
    return this.deps.categories.listCategories(pagination);
  }

  async getPrice(request: PriceRequest): Promise<ComputedPrice> {
    return this.deps.prices.getPrice(request);
  }
}
