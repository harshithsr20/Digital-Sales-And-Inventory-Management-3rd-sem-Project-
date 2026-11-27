const path = require("path");
// Ensure environment variables are loaded
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });
require("dotenv").config({ path: path.resolve(__dirname, "../../../.env") });
require("dotenv").config();

const express = require("express");
const { Pool } = require("pg");
const jwt = require("jsonwebtoken");

// Neon PostgreSQL connection pool reusing DATABASE_URL
const dbPool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const router = express.Router();

// Helper to extract JWT token from Authorization header or cookies
function getTokenFromRequest(req) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.split(" ")[1];
  }
  if (req.headers.cookie) {
    const match = req.headers.cookie.match(/(?:^|;\s*)token=([^;]+)/);
    if (match) return decodeURIComponent(match[1]);
  }
  return null;
}

// Authentication middleware verifying DukaanHub login session / JWT
function requireBusiness(req, res, next) {
  // If an upstream middleware already attached businessId, allow through
  if (req.businessId) {
    return next();
  }

  // Session-based fallback
  if (req.session?.businessId) {
    req.businessId = req.session.businessId;
    return next();
  }

  const token = getTokenFromRequest(req);
  if (!token) {
    return res.status(401).json({ error: "Not logged in" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded || !decoded.businessId) {
      return res.status(401).json({ error: "Not logged in" });
    }
    req.userId = decoded.userId;
    req.businessId = decoded.businessId;
    req.userRole = decoded.role;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Not logged in" });
  }
}

router.use(requireBusiness);

router.get("/", async (req, res) => {
  try {
    const { rows } = await dbPool.query(
      `SELECT inventory_id, product_name, vendor_name, units_present,
              price_wholesale, price_mrp, discount_percent,
              total_sales, sales_per_month, max_sales_month, created_at
         FROM products WHERE business_id = $1 ORDER BY created_at DESC`,
      [req.businessId]
    );
    res.json(rows);
  } catch (err) {
    console.error("Error fetching catalogue products:", err);
    res.status(500).json({ error: "Could not fetch products" });
  }
});

router.get("/movements", async (req, res) => {
  try {
    const { rows } = await dbPool.query(
      `SELECT m.inventory_id, p.product_name, m.movement_type, m.quantity,
              m.reference, m.note, m.occurred_at
         FROM stock_movements m
         JOIN products p
           ON p.business_id = m.business_id AND p.inventory_id = m.inventory_id
        WHERE m.business_id = $1
        ORDER BY m.occurred_at DESC, m.id DESC
        LIMIT 300`,
      [req.businessId]
    );
    return res.json(rows);
  } catch (err) {
    console.error("Error fetching stock movements:", err);
    return res.status(500).json({ error: "Could not fetch stock movements" });
  }
});

router.post("/", async (req, res) => {
  const b = req.body || {};
  const name = String(b.productName || "").trim();
  const vendor = String(b.vendorName || "").trim();
  const units = Number(b.unitsPresent);
  const reorderLevel = b.reorderLevel == null || b.reorderLevel === "" ? 10 : Number(b.reorderLevel);
  const wholesale = Number(b.priceWholesale);
  const mrp = Number(b.priceMrp);
  const discount = b.discount === "" || b.discount == null ? 0 : Number(b.discount);
  const unit = String(b.unit || "pcs").trim();

  if (!name || !vendor) return res.status(400).json({ error: "Product name and vendor are required" });
  if (!Number.isInteger(units) || units < 0) return res.status(400).json({ error: "Units must be a whole number, 0 or more" });
  if (!Number.isInteger(reorderLevel) || reorderLevel < 0) return res.status(400).json({ error: "Reorder level must be a whole number, 0 or more" });
  if (!Number.isFinite(wholesale) || wholesale < 0 || !Number.isFinite(mrp) || mrp < 0) return res.status(400).json({ error: "Prices must be 0 or more" });
  if (!(discount >= 0 && discount <= 100)) return res.status(400).json({ error: "Discount must be between 0 and 100" });
  if (!unit) return res.status(400).json({ error: "Unit is required" });

  let client;
  try {
    client = await dbPool.connect();
    await client.query("BEGIN");

    // Lock the business row to serialize concurrent inserts for the same shop
    await client.query('SELECT id FROM "Business" WHERE id = $1 FOR UPDATE', [req.businessId]);

    // Calculate next sequence number for this specific business
    const maxRes = await client.query(
      `SELECT COALESCE(
         MAX(NULLIF(regexp_replace(split_part(inventory_id, '-', 2), '\\D', '', 'g'), '')::INTEGER),
         0
       ) AS max_num
       FROM products
       WHERE business_id = $1`,
      [req.businessId]
    );

    const nextNum = Number(maxRes.rows[0].max_num || 0) + 1;
    const businessPrefix = String(req.businessId).padStart(4, "0");
    const itemSuffix = String(nextNum).padStart(5, "0");
    const inventoryId = `${businessPrefix}-${itemSuffix}`;

    const { rows } = await client.query(
      `INSERT INTO products
         (business_id, inventory_id, product_name, vendor_name, units_present, price_wholesale, price_mrp, discount_percent, unit, reorder_level)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING inventory_id, product_name, vendor_name, units_present,
                 price_wholesale, price_mrp, discount_percent, unit, reorder_level,
                 total_sales, sales_per_month, max_sales_month, created_at`,
      [req.businessId, inventoryId, name, vendor, units, wholesale, mrp, discount, unit, reorderLevel]
    );

    if (units > 0) {
      await client.query(
        `INSERT INTO stock_movements
           (business_id, inventory_id, movement_type, quantity, reference)
         VALUES ($1, $2, 'ADJ', $3, 'Opening balance')`,
        [req.businessId, inventoryId, units]
      );
    }

    await client.query("COMMIT");
    return res.status(201).json(rows[0]);
  } catch (e) {
    if (client) await client.query("ROLLBACK").catch(() => {});
    if (e.code === "23505") return res.status(409).json({ error: "This product from this vendor is already in your catalogue" });
    console.error("Error inserting catalogue product:", e);
    return res.status(500).json({ error: "Could not save product" });
  } finally {
    if (client) client.release();
  }
});

router.post("/:inventoryId/movements", async (req, res) => {
  const body = req.body || {};
  const type = String(body.type || "").toUpperCase();
  const quantity = Number(body.quantity);
  const unitsPresent = Number(body.unitsPresent);
  const reorderLevel = body.reorderLevel == null ? null : Number(body.reorderLevel);
  const unitCost = body.unitCost == null ? null : Number(body.unitCost);
  const supplier = body.supplier == null ? null : String(body.supplier).trim();
  const reference = body.reference == null ? null : String(body.reference).trim();
  const note = body.note == null ? null : String(body.note).trim();
  const occurredAt = body.occurredAt == null || body.occurredAt === "" ? null : String(body.occurredAt);

  if (type !== "IN" && type !== "ADJ") {
    return res.status(400).json({ error: "Movement type must be IN or ADJ" });
  }
  if (type === "IN" && (!Number.isInteger(quantity) || quantity <= 0)) {
    return res.status(400).json({ error: "Received quantity must be a whole number greater than 0" });
  }
  if (type === "ADJ" && (!Number.isInteger(unitsPresent) || unitsPresent < 0)) {
    return res.status(400).json({ error: "Counted stock must be a whole number, 0 or more" });
  }
  if (reorderLevel !== null && (!Number.isInteger(reorderLevel) || reorderLevel < 0)) {
    return res.status(400).json({ error: "Reorder level must be a whole number, 0 or more" });
  }
  if (unitCost !== null && (!Number.isFinite(unitCost) || unitCost < 0)) {
    return res.status(400).json({ error: "Unit cost must be 0 or more" });
  }
  if (occurredAt !== null && (Number.isNaN(Date.parse(occurredAt)))) {
    return res.status(400).json({ error: "Movement date is invalid" });
  }

  let client;
  try {
    client = await dbPool.connect();
    await client.query("BEGIN");
    const productResult = await client.query(
      `SELECT units_present, reorder_level
         FROM products
        WHERE business_id = $1 AND inventory_id = $2
        FOR UPDATE`,
      [req.businessId, req.params.inventoryId]
    );
    if (!productResult.rowCount) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Product not found" });
    }

    const currentUnits = Number(productResult.rows[0].units_present);
    const nextUnits = type === "IN" ? currentUnits + quantity : unitsPresent;
    const delta = nextUnits - currentUnits;
    const nextReorder = reorderLevel === null ? Number(productResult.rows[0].reorder_level) : reorderLevel;

    await client.query(
      `UPDATE products
          SET units_present = $1,
              reorder_level = $2,
              vendor_name = COALESCE($3, vendor_name),
              price_wholesale = COALESCE($4, price_wholesale),
              updated_at = NOW()
        WHERE business_id = $5 AND inventory_id = $6`,
      [nextUnits, nextReorder, supplier || null, unitCost, req.businessId, req.params.inventoryId]
    );

    if (delta !== 0) {
      await client.query(
        `INSERT INTO stock_movements
           (business_id, inventory_id, movement_type, quantity, reference, note, occurred_at)
         VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7::timestamptz, NOW()))`,
        [req.businessId, req.params.inventoryId, type, delta, reference, note, occurredAt]
      );
    }

    await client.query("COMMIT");
    return res.json({ inventory_id: req.params.inventoryId, units_present: nextUnits, reorder_level: nextReorder });
  } catch (err) {
    if (client) await client.query("ROLLBACK").catch(() => {});
    console.error("Error recording stock movement:", err);
    return res.status(500).json({ error: "Could not record stock movement" });
  } finally {
    if (client) client.release();
  }
});

module.exports = router;
