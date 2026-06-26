CREATE SCHEMA IF NOT EXISTS returns;

CREATE TABLE IF NOT EXISTS returns.return_requests (
  id uuid PRIMARY KEY,
  order_id uuid NOT NULL,
  customer_id uuid NOT NULL,
  status text NOT NULL CHECK (status IN ('requested', 'approved', 'rejected', 'refunded')),
  reason text NOT NULL,
  decision_reason text NULL,
  total_refund_cents bigint NOT NULL DEFAULT 0,
  currency text NOT NULL,
  inventory_restored_at timestamptz NULL,
  ledger_recorded_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS returns.return_lines (
  id uuid PRIMARY KEY,
  return_id uuid NOT NULL REFERENCES returns.return_requests(id) ON DELETE CASCADE,
  product_id uuid NOT NULL,
  qty int NOT NULL CHECK (qty > 0),
  refund_amount_cents bigint NOT NULL CHECK (refund_amount_cents >= 0)
);
