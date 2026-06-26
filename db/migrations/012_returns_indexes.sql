CREATE INDEX IF NOT EXISTS idx_returns_requests_order ON returns.return_requests(order_id);
CREATE INDEX IF NOT EXISTS idx_returns_requests_customer ON returns.return_requests(customer_id);
CREATE INDEX IF NOT EXISTS idx_returns_requests_status ON returns.return_requests(status);
CREATE INDEX IF NOT EXISTS idx_returns_lines_return ON returns.return_lines(return_id);

CREATE UNIQUE INDEX IF NOT EXISTS returns_lines_return_product_uniq
  ON returns.return_lines(return_id, product_id);
