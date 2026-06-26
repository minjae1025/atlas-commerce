CREATE INDEX IF NOT EXISTS idx_notifications_webhooks_customer_active
  ON notifications.webhook_endpoints(customer_id, active);

CREATE INDEX IF NOT EXISTS idx_notifications_webhooks_event_types
  ON notifications.webhook_endpoints USING gin(event_types);

CREATE INDEX IF NOT EXISTS idx_notifications_deliveries_endpoint_status
  ON notifications.notification_deliveries(endpoint_id, status);

CREATE INDEX IF NOT EXISTS idx_notifications_deliveries_due
  ON notifications.notification_deliveries(status, next_attempt_at, created_at)
  WHERE status IN ('pending', 'failed');
