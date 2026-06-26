CREATE SCHEMA IF NOT EXISTS notifications;

CREATE TABLE IF NOT EXISTS notifications.webhook_endpoints (
  id uuid PRIMARY KEY,
  customer_id uuid NOT NULL,
  url text NOT NULL,
  event_types text[] NOT NULL,
  secret text NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (cardinality(event_types) > 0)
);

CREATE TABLE IF NOT EXISTS notifications.notification_deliveries (
  id uuid PRIMARY KEY,
  endpoint_id uuid NOT NULL REFERENCES notifications.webhook_endpoints(id),
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  status text NOT NULL CHECK (status IN ('pending', 'delivered', 'failed')),
  attempts int NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  last_error text NULL,
  next_attempt_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
