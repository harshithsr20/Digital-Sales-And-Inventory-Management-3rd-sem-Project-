-- DukaanHub: product catalogue schema with per-business inventory IDs (e.g. 0001-00001)

CREATE TABLE IF NOT EXISTS products (
  id               BIGSERIAL PRIMARY KEY,
  business_id      INTEGER NOT NULL REFERENCES "Business"("id") ON DELETE CASCADE, -- owner business from registration
  inventory_id     TEXT   NOT NULL,
  product_name     TEXT   NOT NULL,
  units_present    INTEGER       NOT NULL CHECK (units_present >= 0),
  vendor_name      TEXT   NOT NULL,
  price_wholesale  NUMERIC(12,2) NOT NULL CHECK (price_wholesale >= 0),
  price_mrp        NUMERIC(12,2) NOT NULL CHECK (price_mrp >= 0),
  discount_percent NUMERIC(5,2)  NOT NULL DEFAULT 0 CHECK (discount_percent BETWEEN 0 AND 100),
  unit             TEXT   NOT NULL DEFAULT 'pcs',
  reorder_level    INTEGER NOT NULL DEFAULT 10 CHECK (reorder_level >= 0),

  -- Dynamic fields: left NULL for now, filled later by billing/analytics
  total_sales      NUMERIC(14,2),
  sales_per_month  JSONB,          -- e.g. {"2026-10": 42000}
  max_sales_month  TEXT,           -- e.g. "2026-10"

  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (business_id, inventory_id)
);

-- Add inventory fields when upgrading an existing catalogue table.
ALTER TABLE products ADD COLUMN IF NOT EXISTS unit TEXT NOT NULL DEFAULT 'pcs';
ALTER TABLE products ADD COLUMN IF NOT EXISTS reorder_level INTEGER NOT NULL DEFAULT 10 CHECK (reorder_level >= 0);

-- Durable inventory history. Quantity is a signed stock delta for adjustments.
CREATE TABLE IF NOT EXISTS stock_movements (
  id               BIGSERIAL PRIMARY KEY,
  business_id      INTEGER NOT NULL,
  inventory_id     TEXT NOT NULL,
  movement_type    TEXT NOT NULL CHECK (movement_type IN ('IN', 'OUT', 'ADJ')),
  quantity         INTEGER NOT NULL,
  reference        TEXT,
  note             TEXT,
  occurred_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY (business_id, inventory_id)
    REFERENCES products (business_id, inventory_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS stock_movements_business_date
  ON stock_movements (business_id, occurred_at DESC, id DESC);

-- Trigger function to automatically generate per-shop inventory IDs formatted as BBBB-IIIII
-- (e.g. 0001-00001: where 0001 is 4-digit business number, 00001 is 5-digit inventory sequence)
CREATE OR REPLACE FUNCTION generate_inventory_id()
RETURNS TRIGGER AS $$
DECLARE
    next_num INTEGER;
BEGIN
    IF NEW.inventory_id IS NULL OR NEW.inventory_id = '' THEN
        PERFORM 1 FROM "Business" WHERE id = NEW.business_id FOR UPDATE;
        SELECT COALESCE(
            MAX(NULLIF(regexp_replace(split_part(inventory_id, '-', 2), '\D', '', 'g'), '')::INTEGER),
            0
        ) + 1
        INTO next_num
        FROM products
        WHERE business_id = NEW.business_id;

        NEW.inventory_id := lpad(NEW.business_id::text, 4, '0') || '-' || lpad(next_num::text, 5, '0');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_generate_inventory_id ON products;
CREATE TRIGGER trg_generate_inventory_id
BEFORE INSERT ON products
FOR EACH ROW
EXECUTE FUNCTION generate_inventory_id();

-- Same product from the same vendor can't be listed twice for one business
CREATE UNIQUE INDEX IF NOT EXISTS products_unique_item
  ON products (business_id, lower(product_name), lower(vendor_name));
