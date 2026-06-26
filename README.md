# Atlas Commerce

**The wholesale commerce backend for B2B buyers.** Atlas Commerce powers the full
order-to-cash journey for wholesale: retail businesses browse a catalog, reserve
stock across warehouses, place bulk orders, pay in their own currency, request
returns, and reconcile everything into daily financial settlement.

It runs as a production-style service fleet — an API gateway in front of focused
domain services (catalog, inventory, orders, payments, settlement, returns,
notifications), backed by PostgreSQL and Redis, with a synthetic monitor that
exercises the platform end to end.

## What it does

- **Catalog & pricing** — products, categories, and price rules, with per-tier
  discounts (standard / gold / platinum) and multi-currency pricing via live FX.
- **Multi-warehouse inventory** — stock levels, reservations that can split across
  warehouses, commit/release, adjustments, and inter-warehouse transfers.
- **Order orchestration** — one call turns a bulk order into priced lines →
  reserved stock → captured payment → committed stock → a confirmed order, with
  automatic compensation on any failure.
- **Payments** — payment intents and capture through a PSP, idempotent per key,
  with FX conversion.
- **Settlement** — a financial ledger (charges, refunds, fees, payouts), daily and
  period reports, and settlement runs for reconciliation.
- **Returns** — RMA requests that restock inventory and post refunds to the ledger.
- **Notifications** — webhook fan-out so buyers' systems can subscribe to order and
  payment events.

### Order flow (happy path)

1. `POST /api/orders/orders` — validate the buyer and line items
2. price each line via **catalog** (rules + tier + currency)
3. reserve stock via **inventory** (may split across warehouses)
4. create and capture a payment intent via **payments**
5. commit the reservation (decrement on-hand) and confirm the order
6. **payments** and **orders** post ledger entries to **settlement**

On any failure, reservations are released and the payment intent is voided.

## Quickstart

```bash
docker compose up
```

Starts PostgreSQL and Redis, runs migrations plus deterministic seed data, boots
the application services, waits for the gateway to become ready, then starts
synthetic traffic. All external traffic enters through the gateway at
`http://localhost:8080`.

Seed API keys:

```text
demo-key-1
demo-key-2
```

## Services

| Service | Port | Purpose |
|---|---:|---|
| `gateway` | 8080 | API gateway: API-key auth, rate limiting, service routing |
| `catalog` | 7002 | Products, categories, price rules, computed pricing |
| `inventory` | 7003 | Warehouses, stock levels, reservations, transfers |
| `orders` | 7004 | Order orchestration, lifecycle, shipments |
| `payments` | 7005 | Payment intents, capture, FX |
| `settlement` | 7006 | Ledger, daily/period reports, settlement runs |
| `returns` | 7007 | Return requests, restock, refunds |
| `notifications` | 7008 | Webhook subscriptions and event fan-out |
| `synthetic-monitor` | internal | Continuous synthetic traffic + invariant checks |

## Useful commands

```bash
npm run migrate
npm run typecheck:shared
npm run typecheck:synthetic-monitor
npm test
```

## Repository map

| Path | Description |
|---|---|
| `docs/architecture.md` | System architecture and runtime model |
| `docs/contracts.md` | Integration contract: APIs, schemas, env, shared library |
| `packages/shared` | Shared logger, config, DB, cache, HTTP client, retry, idempotency, errors, middleware, money helpers |
| `db/migrations` | Ordered PostgreSQL migrations |
| `db/seed` | Deterministic seed generator and data |
| `services/*` | Service implementations |

## Operations notes

Every service uses one PostgreSQL database with a schema per service. Services own
their schema exclusively and communicate over HTTP for cross-service reads and
writes. Redis backs caching, idempotency, API-key / rate-limit state, and other
short-lived coordination.

The synthetic monitor drives traffic only through the gateway with
`x-api-key: demo-key-1`. Healthy runs produce structured service logs and no
`ALERT` lines.
