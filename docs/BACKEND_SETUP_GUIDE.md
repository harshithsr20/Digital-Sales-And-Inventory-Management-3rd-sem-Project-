# DukaanHub — Project Handover & Setup Guide

> **Agent & Developer Context Notice**: This document provides full architectural context, database configuration, environment setup, and exact execution instructions for developers and AI coding assistants working on DukaanHub.

---

## 1. Project Overview & Architecture

**DukaanHub** is a wholesale billing, inventory management, and catalogue web application built with a decoupled architecture:

- **Frontend (`frontend/`)**: Vanilla HTML5, Tailwind CSS (CDN), Material Symbols, custom CSS tokens (`assets/css/theme.css`, `assets/css/animations.css`).
  - [`frontend/index.html`](file:///c:/Users/ASUS/3rd%20Sem%20Project/frontend/index.html): Public landing page with features overview and login/registration entry points.
  - [`frontend/registrationPage.html`](file:///c:/Users/ASUS/3rd%20Sem%20Project/frontend/registrationPage.html): Wholesale business onboarding & admin registration form.
  - [`frontend/login.html`](file:///c:/Users/ASUS/3rd%20Sem%20Project/frontend/login.html): Console sign-in page for existing businesses.
  - [`frontend/mainDashboard.html`](file:///c:/Users/ASUS/3rd%20Sem%20Project/frontend/mainDashboard.html): Protected wholesale operational terminal and live dashboard.
  - [`frontend/catalogue.html`](file:///c:/Users/ASUS/3rd%20Sem%20Project/frontend/catalogue.html): Wholesale product catalogue management with auto-generated inventory IDs.
- **Backend (`backend/`)**: Node.js, Express 5, Prisma ORM 6 (`@prisma/client@6`), PostgreSQL on Neon Cloud (`pg` connection pool).
- **Security**: Passwords hashed using `bcrypt` (10 rounds). Protected routes validated via JWT (`jsonwebtoken`) and session cookies.

---

## 2. Directory Structure

```text
3rd Sem Project/
├── .env                         # Root environment variables
├── package.json                 # Root script runner (npm run dev / npm start)
├── server.js                    # Root Express server entry point
├── docs/
│   ├── BACKEND_SETUP_GUIDE.md   # This setup & AI handover guide
│   └── design.md                # Design system & tokens specification
├── frontend/
│   ├── index.html               # Landing page
│   ├── login.html               # Console sign in
│   ├── registrationPage.html    # Business registration
│   ├── mainDashboard.html       # Primary wholesale console
│   ├── catalogue.html           # Product catalogue manager
│   └── assets/                  # CSS tokens, animations, JS controllers
└── backend/
    ├── .env                     # Backend environment variables
    ├── package.json             # Backend dependencies (express, pg, prisma, etc.)
    ├── database/
    │   └── schema.sql           # SQL table definitions for products & sequences
    ├── prisma/
    │   ├── migrations/          # Version-controlled migrations
    │   └── schema.prisma        # Business & User Prisma schema
    └── src/
        ├── middleware/          # authMiddleware.js (JWT validation)
        ├── routes/
        │   ├── auth.js          # Authentication endpoints (/api/auth)
        │   └── catalogue.routes.js # Catalogue endpoints (/api/products)
        ├── utils/               # validators.js (GST, email validation)
        ├── prisma.js            # Shared Prisma Client instance
        └── server.js            # Express application router & static host
```

---

## 3. Database: Neon PostgreSQL & Prisma 6

DukaanHub uses **Neon Serverless PostgreSQL**.

### Models & Tables:
1. **`Business`** (`schema.prisma`):
   - `id`: Auto-incrementing integer (Primary Key).
   - `name`: Wholesale business name.
   - `gstNumber`: Unique GSTIN string (Indian 15-character standard).
   - `address`: Store / warehouse location.
   - `email`: Unique business email.
   - `createdAt`: Timestamp.
   - `users`: Relation (`User[]`).

2. **`User`** (`schema.prisma`):
   - `id`: Auto-incrementing integer (Primary Key).
   - `email`: Admin / login email (Unique).
   - `passwordHash`: Bcrypt hashed password.
   - `role`: Role string (`"admin"` default).
   - `businessId`: Foreign key to `Business.id`.
   - `createdAt`: Timestamp.

3. **`products`** (`backend/database/schema.sql`):
   - `id`: BigSerial Primary Key.
   - `business_id`: Integer foreign key referencing `"Business"("id")` with `ON DELETE CASCADE`.
   - `inventory_id`: Formatted text string (`0001-00001`: 4-digit business number + 5-digit per-shop inventory sequence).
   - `product_name`: Text.
   - `units_present`: Integer (>= 0).
   - `vendor_name`: Text.
   - `price_wholesale`: Numeric (>= 0).
   - `price_mrp`: Numeric (>= 0).
   - `discount_percent`: Numeric (0 to 100).
   - `total_sales`, `sales_per_month`, `max_sales_month`: Analytics fields (nullable initially).
   - Unique constraint on `(business_id, lower(product_name), lower(vendor_name))`.

---

## 4. Setup Instructions for Developers

Follow these steps after cloning or pulling the branch:

### Step 1: Place Environment Variables (`.env`)
Make sure the team `.env` file provided separately is placed into the `backend/` directory (and optionally in the root directory):
- `backend/.env`
- `.env` (root)

The file must contain:
```env
PORT=5000
DATABASE_URL="<your_neon_database_url_provided_separately>"
DATABASE_URL_POOLED="<your_neon_pooled_database_url_provided_separately>"
JWT_SECRET="<your_jwt_secret_provided_separately>"
```

### Step 2: Install Dependencies
Install dependencies in the `backend/` folder:
```bash
cd backend
npm install
cd ..
```

### Step 3: Generate the Prisma Client
Generate the `@prisma/client` artifacts:
```bash
cd backend
npx prisma generate
cd ..
```

*(Note: The database tables on Neon are already provisioned. If starting with an empty database, run `npx prisma migrate deploy` followed by running `backend/database/schema.sql` in the Neon SQL Editor).*

### Step 4: Run the Backend Server
From the root directory:
```bash
npm run dev
```
*(Or navigate to `backend/` and run `npm run dev`)*

When running successfully, you will see:
```text
Server listening on port 5000
```

---

## 5. Teammate AI Instructions (Prompt for AI Assistants)

> **Copy and paste this section directly into your AI coding assistant (Antigravity, Cursor, Copilot, Claude Code) to have it set up your workspace automatically:**

```markdown
I have pulled the DukaanHub repository to my machine. Please set up and verify the backend by performing the following steps:

1. ENVIRONMENT SETUP:
   - Check if `.env` exists in `backend/.env` (and optionally the root directory).
   - If missing, prompt me to provide the `.env` credentials shared separately with the team.
   - Verify that `PORT=5000`, `DATABASE_URL`, and `JWT_SECRET` are present.

2. INSTALL PACKAGES & GENERATE PRISMA:
   - Navigate into `backend/` and run `npm install`.
   - Run `npx prisma generate` in `backend/` so that `@prisma/client` matches the Prisma schema.

3. SANITY VERIFICATION:
   - Run `node -c backend/src/server.js` and `node -c server.js` to ensure zero syntax errors.
   - Run a test check with `node -e "require('./backend/src/server'); console.log('Backend loaded successfully');"` to confirm all routes, middleware, and database pools import cleanly.

4. START THE SERVER:
   - Start the backend server on port 5000 using `npm run dev` or `node backend/src/server.js`.
   - Confirm it outputs `Server listening on port 5000`.
   - Check that endpoints `http://localhost:5000/api` and `http://localhost:5000/catalogue.html` respond.
```

---

## 6. API Endpoints Reference

Base URL: `http://localhost:5000`

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/register` | Atomically provisions a new `Business` and owner `User`. Returns HTTP 201 + session token. | No |
| `POST` | `/api/auth/login` | Authenticates email & password, returns JWT token + session cookie. | No |
| `POST` | `/api/auth/logout` | Clears authentication session cookie. | No |
| `GET` | `/api/me` | Fetches active user profile and linked wholesale business record. | Yes (`Bearer <token>`) |
| `GET` | `/api/products` | Returns all catalogue products belonging to the logged-in business. | Yes (`Bearer <token>`) |
| `POST` | `/api/products` | Adds a new product row with auto-generated per-shop `0001-00001` ID. | Yes (`Bearer <token>`) |

---

## 7. Frontend Testing Flow

1. Open `frontend/index.html` via VS Code Live Server (`http://127.0.0.1:5500/frontend/index.html`) or directly through Express (`http://localhost:5000/index.html`).
2. Click **Log In** to test sign in on `login.html`, or **Get Started** to register on `registrationPage.html`.
3. Once logged in, navigate to `mainDashboard.html` and click **Catalogue** to add products and confirm real-time synchronization with Neon PostgreSQL.
