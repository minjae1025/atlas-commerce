# Atlas Commerce

**B2B 바이어를 위한 도매 커머스 백엔드.** Atlas Commerce는 도매 거래의 order-to-cash
전 과정을 책임집니다 — 소매 사업자가 카탈로그를 조회하고, 여러 창고에 걸쳐 재고를
예약하고, 대량 주문을 넣고, 자국 통화로 결제하고, 반품을 요청하고, 이 모든 것을
일일 재무 정산으로 마감합니다.

운영 환경에 가까운 서비스 집합으로 동작합니다 — API 게이트웨이 뒤에 도메인별 서비스
(catalog, inventory, orders, payments, settlement, returns, notifications)가 있고,
PostgreSQL과 Redis가 받쳐주며, 합성 모니터가 플랫폼을 end-to-end로 구동합니다.

## 무엇을 하나

- **카탈로그 & 가격** — 상품·카테고리·가격 규칙. 등급별 할인(standard / gold / platinum)과
  실시간 FX 기반 다중 통화 가격.
- **멀티 창고 재고** — 재고 수량, 여러 창고로 분할 가능한 예약, 확정/해제, 조정,
  창고 간 이전.
- **주문 오케스트레이션** — 한 번의 호출로 대량 주문을 가격 산정 → 재고 예약 →
  결제 캡처 → 재고 확정 → 주문 확정까지 처리하며, 어떤 실패에도 자동 보상합니다.
- **결제** — PSP를 통한 결제 의도·캡처, 키 단위 멱등성, FX 변환.
- **정산** — 재무 원장(청구·환불·수수료·지급), 일일/기간 리포트, 정산 실행(reconcile).
- **반품** — 재고를 복원하고 환불을 원장에 기록하는 RMA 요청.
- **알림** — 바이어 시스템이 주문·결제 이벤트를 구독할 수 있는 webhook fan-out.

### 주문 흐름 (정상 경로)

1. `POST /api/orders/orders` — 바이어와 주문 항목 검증
2. **catalog**로 라인별 가격 산정 (규칙 + 등급 + 통화)
3. **inventory**로 재고 예약 (여러 창고로 분할 가능)
4. **payments**로 결제 의도 생성·캡처
5. 예약 확정(on-hand 차감) 후 주문 확정
6. **payments**와 **orders**가 **settlement**에 원장 항목 기록

어떤 실패에서든 예약은 해제되고 결제 의도는 void 처리됩니다.

## Quickstart

```bash
docker compose up
```

PostgreSQL과 Redis를 시작하고, 마이그레이션과 결정론적 시드 데이터를 실행한 뒤,
애플리케이션 서비스를 기동하고, 게이트웨이가 준비될 때까지 대기한 후 합성 트래픽을
시작합니다. 외부 트래픽은 모두 `http://localhost:8080`의 게이트웨이로 유입됩니다.

시드 API 키:

```text
demo-key-1
demo-key-2
```

## Services

| Service | Port | Purpose |
|---|---:|---|
| `gateway` | 8080 | API 게이트웨이: API 키 인증, 속도 제한, 서비스 라우팅 |
| `catalog` | 7002 | 상품, 카테고리, 가격 규칙, 계산된 가격 |
| `inventory` | 7003 | 창고, 재고 수량, 예약, 창고 간 이전 |
| `orders` | 7004 | 주문 오케스트레이션, 라이프사이클, 배송 |
| `payments` | 7005 | 결제 의도, 캡처, FX |
| `settlement` | 7006 | 원장, 일일/기간 리포트, 정산 실행 |
| `returns` | 7007 | 반품 요청, 재고 복원, 환불 |
| `notifications` | 7008 | webhook 구독 및 이벤트 fan-out |
| `synthetic-monitor` | internal | 지속적 합성 트래픽 + 불변성 검사 |

## Useful commands

```bash
npm run migrate
npm run typecheck:shared
npm run typecheck:synthetic-monitor
npm test
```

## Repository Map

| Path | Description |
|---|---|
| `docs/architecture.md` | 시스템 아키텍처 및 런타임 모델 |
| `docs/contracts.md` | 통합 계약: API, 스키마, 환경변수, 공유 라이브러리 |
| `packages/shared` | 공유 로거·설정·DB·캐시·HTTP 클라이언트·재시도·멱등성·오류·미들웨어·통화 헬퍼 |
| `db/migrations` | 정렬된 PostgreSQL 마이그레이션 |
| `db/seed` | 결정론적 시드 생성기와 데이터 |
| `services/*` | 서비스 구현 |

## Operations Notes

각 서비스는 하나의 PostgreSQL 데이터베이스를 사용하며 서비스별로 스키마를 분리합니다.
서비스는 자신의 스키마를 배타적으로 소유하고, 서비스 간 읽기/쓰기는 HTTP로 통신합니다.
Redis는 캐시, 멱등성, API 키/속도 제한 상태, 기타 단기 조정에 사용됩니다.

합성 모니터는 `x-api-key: demo-key-1`로 게이트웨이를 통해서만 트래픽을 발생시킵니다.
정상 동작에서는 구조화된 서비스 로그만 출력되고 `ALERT` 라인이 나오지 않습니다.
