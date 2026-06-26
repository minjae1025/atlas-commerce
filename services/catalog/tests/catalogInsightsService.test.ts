import { describe, expect, it, vi } from "vitest";
import type { Logger } from "@atlas/shared";
import { buildCategoryTree, rankProducts } from "../src/domain/catalogInsightsService.js";
import type { Category, Product } from "../src/domain/types.js";

const logger = (): Logger =>
  ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: vi.fn()
  }) as unknown as Logger;

const product = (overrides: Partial<Product>): Product => ({
  id: "11111111-1111-4111-8111-111111111111",
  sku: "ATLAS-WIDGET",
  name: "Atlas Widget",
  description: "Durable warehouse accessory",
  categoryId: "22222222-2222-4222-8222-222222222222",
  basePriceCents: 1200,
  currency: "USD",
  status: "active",
  createdAt: "2026-06-01T00:00:00.000Z",
  updatedAt: "2026-06-12T00:00:00.000Z",
  ...overrides
});

describe("catalog insight helpers", () => {
  it("scores search hits by matched fields and price bounds", () => {
    const hits = rankProducts(
      [
        product({ sku: "PRO-SCANNER", name: "Scanner Dock", basePriceCents: 900 }),
        product({ sku: "CABLE", name: "Cable", description: "Scanner USB cable", basePriceCents: 200 }),
        product({ sku: "SCANNER-LUX", name: "Premium Scanner", basePriceCents: 2200 })
      ],
      {
        q: "scanner",
        minPriceCents: 300,
        maxPriceCents: 2000,
        sort: "relevance",
        limit: 50,
        offset: 0
      }
    );

    expect(hits).toHaveLength(1);
    expect(hits[0]?.matchedFields).toEqual(["name", "sku"]);
  });

  it("builds a stable category tree", () => {
    const categories: Category[] = [
      { id: "root-b", name: "Warehouse", parentId: null },
      { id: "child", name: "Scanners", parentId: "root-b" },
      { id: "root-a", name: "Apparel", parentId: null }
    ];

    expect(buildCategoryTree(categories)).toEqual([
      { id: "root-a", name: "Apparel", parentId: null, children: [] },
      {
        id: "root-b",
        name: "Warehouse",
        parentId: null,
        children: [{ id: "child", name: "Scanners", parentId: "root-b", children: [] }]
      }
    ]);
    expect(logger).toBeTypeOf("function");
  });
});
