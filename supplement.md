# Atlas Commerce — 보완 필요 사항

이 문서는 프로젝트 전반을 분석하여 발견된 버그, 누락, 불일치, 개선 기회를 정리합니다.

---

## 1. 🔴 크리티컬: `catalog` 서비스 KRW 환율 조회 버그

**위치**: `services/catalog/src/clients/payments.ts:33`

```ts
const lookupQuote = quote === "KRW" ? "KWR" : quote;
```

유효하지 않은 ISO 4217 통화 코드 `KWR`로 변환되어, **KRW 가격 조회가 항상 실패**합니다.

| 필드 | 값 |
|------|-----|
| 지원 통화 | `USD`, `KRW`, `JPY`, `EUR` (`services/catalog/src/domain/currency.ts:1`) |
| 버그 코드 | `KRW` → `KWR` (오타) |
| 조회 실패 시 | `rate: 0` 반환 (fallback이 버그를 은폐) |
| 영향 | **모든 KRW 통화 가격 조회가 잘못된 결과** |

**수정 방향**: `KWR` → `KRW`로 변경. 또는 불필요한 매핑 자체를 제거.

---

## 2. 🟠 문서: `docs/contracts.md` 최신화 누락

`returns`(7007)와 `notifications`(7008) 서비스가 운영 중이지만 **계약서에 반영되지 않음**.

| 항목 | 누락 내용 | 현재 상태 |
|------|-----------|-----------|
| §2 Database | `returns`, `notifications` 스키마 | 5개 스키마만 명시 |
| §3 Service APIs | returns, notifications API 명세 | 5개 서비스만 명시 |
| §3 gateway | `/api/returns/*`, `/api/notifications/*` 라우팅 | 5개 경로만 명시 |
| §5 Compose contract | `returns`, `notifications` 서비스명 | 10개 서비스만 명시 |
| §2 Seed | returns/notifications 시드 데이터 설명 | 5개 스키마만 명시 |

---

## 3. 🟠 `.env.example` 환경변수 누락

현재 **12개 변수**만 정의되어 있으나, 실제 필요한 변수는 **최소 18개 이상**입니다.

### 현재 정의됨 (12개)

```
DATABASE_URL, REDIS_URL, LOG_LEVEL, GATEWAY_API_KEYS, PSP_FAIL_RATE,
GATEWAY_URL, CATALOG_URL, INVENTORY_URL, ORDERS_URL, PAYMENTS_URL, SETTLEMENT_URL
```

### 누락된 변수 (8개+)

| 변수 | 용도 | 사용처 |
|------|------|--------|
| `PORT` | 서비스별 포트 | 모든 서비스 |
| `RETURNS_URL` | 게이트웨이 라우팅 | gateway |
| `NOTIFICATIONS_URL` | 게이트웨이 라우팅 | gateway |
| `API_KEY` | synthetic-monitor 인증 | synthetic-monitor |
| `CYCLE_INTERVAL_MS` | 모니터링 주기 | synthetic-monitor |
| `SETTLEMENT_URL` | 원장 항목 등록 | payments, orders, returns |
| `ORDERS_URL` | 주문 조회 | returns |
| `INVENTORY_URL` | 재고 예약 | orders, returns |

---

## 4. 🟠 테스트 커버리지 부족

**31개 테스트 파일, 71개 테스트 모두 통과**하지만 단위 테스트에 편중되어 있습니다.

### 테스트 현황

| 계층 | 테스트 수 | 커버리지 |
|------|-----------|----------|
| **도메인/서비스 로직** | 71개 | 있음 |
| **컨트롤러 (HTTP 레이어)** | **0개** | ❌ |
| **레포지토리 (SQL)** | 1개 파일 (`stockLevelSql`) | 24개 중 1개만 테스트 |
| **미들웨어** | **0개** | ❌ |
| **Express 앱(app.ts) 통합** | **0개** | ❌ |
| **서비스 간 통합** | **0개** | ❌ |
| **E2E (엔드투엔드)** | **0개** | ❌ |

### `synthetic-monitor` — 테스트 미존재

```json
// services/synthetic-monitor/package.json
{
  "scripts": {
    "start": "tsx src/index.ts",
    "typecheck": "tsc -p tsconfig.json --noEmit"
    // "test": "vitest run"  ← 누락
  },
  "devDependencies": {
    "vitest": "^2.1.1"         // vitest는 설치되어 있음
  }
}
```

전체 시스템의 **이상 징후 탐지기** 역할을 하는 서비스인데 테스트가 하나도 없습니다.

---

## 5. 🟠 에러 처리 패턴 불일치

같은 프로젝트 내에서 **3가지 다른 에러 처리 패턴**이 혼용되고 있습니다.

| 패턴 | 사용 서비스 | 예시 코드 |
|------|------------|-----------|
| **try/catch → `next(err)`** | orders, inventory, gateway middleware | `try { ... } catch (err) { next(err) }` |
| **`asyncHandler` wrapper** | catalog, gateway routes | `asyncHandler(async (req, res) => { ... })` |
| **`.catch(next)`** | payments, returns, settlement, notifications | `router.get("/path", handler).catch(next)` |

---

## 6. 🟠 Express 타입 선언 방식 불일치

**4개 서비스**가 각각 다른 방식으로 Express의 `Request` 타입을 확장하고 있습니다.

| 서비스 | 방식 | 파일 |
|--------|------|------|
| **gateway** | `declare global { namespace Express { ... } }` | `services/gateway/src/types/express.d.ts` |
| **catalog** | `declare global { namespace Express { ... } }` + `export {}` | `services/catalog/src/types/express.d.ts` |
| **orders** | `declare module "express-serve-static-core" { ... }` (권장 방식) | `services/orders/src/types/express.d.ts` |
| **returns** | `declare namespace Express { ... }` (legacy, 오래된 방식) | `services/returns/src/types/express.d.ts` |

---

## 7. 🟠 테스트 내 타입 안전성 우회

### `as never` 사용 (13건)

```ts
// services/orders/tests/cancelOrder.test.ts:30-33
orders: orders as never,
shipments: shipments as never,
inventory: inventory as never,
payments: payments as never,

// services/returns/tests/approveReturn.test.ts:44
orders: {} as never,
```

타입 시스템을 완전히 우회하여, **인터페이스 변경 시 테스트가 깨지지 않고 컴파일을 통과**할 위험이 있습니다.

### `as unknown as X` 사용 (17건)

```ts
// services/orders/tests/fixtures.ts:53
}) as unknown as Logger;

// services/inventory/tests/stockOperationsService.test.ts:27
} as unknown as Cache;
```

---

## 8. 🟡 코드 품질 이슈

### 8-1. `req.params`非 null 단언

**`services/payments/src/controllers/fxController.ts:10-11`**

```ts
const base = req.params.base!;   // undefined일 경우 !가 의미 없음
const quote = req.params.quote!; // Zod 검증 없이 그대로 사용
```

`req.params`는 Express 타이핑상 `string | undefined`입니다. `!` 단언 후 정규식으로 검증하지만, `undefined` 전달 시 정규식 검증을 통과하지 못하고 `throw`됩니다.

### 8-2. `catalog/src/jobs/index.ts` 빈 스텁

```ts
export {};
```

`src/jobs/` 디렉토리는 생성되었지만 아무런 구현이 없습니다. 제거하거나 실제 Job을 구현해야 합니다.

### 8-3. 멱등성 락 정리 시점 레이스 컨디션

**`packages/shared/src/idempotency.ts:55-66`**

```ts
try {
  const result = await fn();
  await cache.set(resultKey, ...);
  return { result, replayed: false };
} catch (err) {
  const currentToken = await internals.getRaw(lockKey);
  if (currentToken === token) {
    await internals.delRaw(lockKey);   // ← (A)
  }
  throw err;
} finally {
  const currentToken = await internals.getRaw(lockKey);
  if (currentToken === token) {
    await internals.delRaw(lockKey);   // ← (B)
  }
}
```

`catch` 블록 (A)와 `finally` 블록 (B) 사이에서 **Redis 락 TTL이 만료**될 경우, 다른 프로세스가 획득한 락을 실수로 삭제할 수 있습니다.

### 8-4. 템플릿 리터럴 SQL (경미)

**`services/settlement/src/repositories/ledgerReadRepo.ts:84`**

```ts
`SELECT date_trunc('${unit}', created_at)::date AS bucket_start,
```

현재 `unit`은 `bucketSql` 레코드(`"day"`, `"week"`, `"month"`)로 제한되어 안전하지만, 향후 리팩터링 시 **SQL 인젝션 위험**이 생길 수 있습니다.

### 8-5. Gateway Content-Type 검증 느슨함

**`services/gateway/src/clients/jsonProxyClient.ts:89-92`**

```ts
const contentType = response.headers.get('content-type') ?? '';
if (!contentType.includes('application/json')) {
  return text;
}
```

문자열 포함 검사만 하므로, `application/json; charset=utf-8`은 통과하지만 이는 의도된 동작입니다.

---

## 9. 🟡 빌드/Docker 설정

### Gateway에 `start` 스크립트 없음

```json
// services/gateway/package.json
{
  "scripts": {
    "dev": "tsx src/index.ts",    // 있음
    "start": ...                  // 없음 — 다른 서비스와 불일치
  }
}
```

### Gateway Docker 의존성 부족

`docker-compose.yml`에서 `gateway`는 `migrator`에만 의존합니다. 그러나 backend 서비스(catalog, inventory, orders, payments, settlement, returns, notifications)가 아직 준비되지 않은 상태에서 요청을 받을 수 있습니다.

---

## 10. 📊 요약

### 발견된 문제 우선순위

| 우선순위 | 문제 | 영향 범위 | 난이도 |
|----------|------|-----------|--------|
| 🔴 **P0** | KRW→KWR 환율 조회 버그 | KRW 거래 전체 | 낮음 |
| 🟠 **P1** | 계약서(`contracts.md`) 미반영 | 문서 신뢰성 | 낮음 |
| 🟠 **P1** | `.env.example` 변수 누락 | 개발 온보딩 | 낮음 |
| 🟠 **P1** | 컨트롤러/통합 테스트 부재 | 회귀 검출 취약 | 높음 |
| 🟠 **P1** | `synthetic-monitor` 테스트 부재 | 모니터링 신뢰성 | 중간 |
| 🟠 **P2** | 에러 처리 패턴 불일치 | 유지보수성 | 중간 |
| 🟠 **P2** | Express 타입 선언 불일치 | 타입 안전성 | 낮음 |
| 🟠 **P2** | `as never` 타입 우회 (13건) | 테스트 신뢰성 | 낮음 |
| 🟡 **P3** | 빈 Job 스텁 (`catalog/jobs`) | 혼란 | 낮음 |
| 🟡 **P3** | 멱등성 락 레이스 컨디션 | 동시성 버그 | 중간 |
| 🟡 **P3** | 템플릿 리터럴 SQL | 잠재적 보안 | 낮음 |

### 서비스별 테스트 커버리지

| 서비스 | 소스 파일 | 테스트 파일 | 테스트 수 | 컨트롤러 테스트 | 통합/E2E |
|--------|-----------|-------------|-----------|:--------------:|:--------:|
| shared | 12 | 3 | 5 | — | — |
| gateway | 39 | 3 (+1 mock) | 8 | ❌ | ❌ |
| catalog | 55 | 6 (+1 helper) | 11 | ❌ | ❌ |
| inventory | 50 | 4 | 11 | ❌ | ❌ |
| orders | 52 | 7 (+1 helper) | 13 | ❌ | ❌ |
| payments | 30 | 2 | 4 | ❌ | ❌ |
| returns | 17 | 2 | 5 | ❌ | ❌ |
| settlement | 17 | 2 | 6 | ❌ | ❌ |
| notifications | 16 | 3 (+1 helper) | 8 | ❌ | ❌ |
| **synthetic-monitor** | 22 | **0** | **0** | — | — |
| **합계** | **310** | **31** | **71** | **0** | **0** |

### 🟢 잘된 점 (유지할 강점)

| 항목 | 설명 |
|------|------|
| **타입 안전성** | `strict: true`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` 준수, `any` 타입 0개 |
| **SQL 보안** | 모든 쿼리 파라미터화 — SQL 인젝션 위험 없음 |
| **DB 정합성** | 19개 테이블 모두 계약서와 일치, 적절한 인덱스와 FK 존재 |
| **시드 데이터** | 결정론적 생성, 명세와 볼륨 일치 (600 상품, 80 고객, 3 창고 등) |
| **멱등성 처리** | 키 기반 멱등성으로 중복 주문/결제 방지 |
| **분산 보상** | 주문 실패 시 예약 해제 + 결제 void 자동 처리 |
| **스키마 분리** | 서비스별 DB 스키마 완전 격리, 크로스 스키마 직접 접근 금지 |
| **테스트 품질** | 71개 단위 테스트 전부 통과, 비즈니스 로직 커버리지 양호 |
