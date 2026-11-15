const path = require("path");

// Allow resolving dependencies installed in backend/node_modules
const backendNodeModules = path.resolve(__dirname, "../backend/node_modules");
if (!module.paths.includes(backendNodeModules)) {
  module.paths.unshift(backendNodeModules);
}

// Ensure environment variables are loaded
require("dotenv").config({ path: path.resolve(__dirname, "../backend/.env") });
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });
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

router.post("/", async (req, res) => {
  const b = req.body || {};
  const name = String(b.productName || "").trim();
  const vendor = String(b.vendorName || "").trim();
  const units = Number(b.unitsPresent);
  const wholesale = Number(b.priceWholesale);
  const mrp = Number(b.priceMrp);
  const discount = b.discount === "" || b.discount == null ? 0 : Number(b.discount);

  if (!name || !vendor) return res.status(400).json({ error: "Product name and vendor are required" });
  if (!Number.isInteger(units) || units < 0) return res.status(400).json({ error: "Units must be a whole number, 0 or more" });
  if (!(wholesale >= 0) || !(mrp >= 0)) return res.status(400).json({ error: "Prices must be 0 or more" });
  if (!(discount >= 0 && discount <= 100)) return res.status(400).json({ error: "Discount must be between 0 and 100" });

  try {
    const { rows } = await dbPool.query(
      `INSERT INTO products
         (business_id, product_name, vendor_name, units_present, price_wholesale, price_mrp, discount_percent)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING inventory_id, product_name, vendor_name, units_present,
                 price_wholesale, price_mrp, discount_percent,
                 total_sales, sales_per_month, max_sales_month, created_at`,
      [req.businessId, name, vendor, units, wholesale, mrp, discount]
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    if (e.code === "23505") return res.status(409).json({ error: "This product from this vendor is already in your catalogue" });
    console.error("Error inserting catalogue product:", e);
    res.status(500).json({ error: "Could not save product" });
  }
});

module.exports = router;
