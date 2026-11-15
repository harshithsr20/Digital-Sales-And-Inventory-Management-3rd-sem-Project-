-- DukaanHub: product catalogue (run once in the Neon SQL editor)

CREATE SEQUENCE IF NOT EXISTS inventory_id_seq START 1;

CREATE TABLE IF NOT EXISTS products (
  id               BIGSERIAL PRIMARY KEY,
  business_id      INTEGER NOT NULL REFERENCES "Business"("id") ON DELETE CASCADE, -- owner business from registration
  inventory_id     TEXT   NOT NULL
                   DEFAULT ('INV-' || lpad(nextval('inventory_id_seq')::text, 6, '0')),
  product_name     TEXT   NOT NULL,
  units_present    INTEGER       NOT NULL CHECK (units_present >= 0),
  vendor_name      TEXT   NOT NULL,
  price_wholesale  NUMERIC(12,2) NOT NULL CHECK (price_wholesale >= 0),
  price_mrp        NUMERIC(12,2) NOT NULL CHECK (price_mrp >= 0),
  discount_percent NUMERIC(5,2)  NOT NULL DEFAULT 0 CHECK (discount_percent BETWEEN 0 AND 100),

  -- Dynamic fields: left NULL for now, filled later by billing/analytics
  total_sales      NUMERIC(14,2),
  sales_per_month  JSONB,          -- e.g. {"2026-10": 42000}
  max_sales_month  TEXT,           -- e.g. "2026-10"

  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (business_id, inventory_id)
);

-- Same product from the same vendor can't be listed twice for one business
CREATE UNIQUE INDEX IF NOT EXISTS products_unique_item
  ON products (business_id, lower(product_name), lower(vendor_name));
