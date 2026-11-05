# DukaanHub — Project Handover & Setup Guide

> **Agent Context Notice**: This document provides full architectural context, database configuration, and setup instructions for AI coding assistants and team developers working on DukaanHub.

---

## 1. Project Overview & Architecture

**DukaanHub** is a college wholesale billing and inventory web application.

- **Frontend**: Vanilla HTML5, Tailwind CSS (CDN), Material Symbols, Custom CSS (`assets/css/`).
  - [`index.html`](file:///c:/Users/ASUS/3rd%20Sem%20Project/index.html): Landing page.
  - [`registrationPage.html`](file:///c:/Users/ASUS/3rd%20Sem%20Project/registrationPage.html): Business & owner registration form with live store sale animation overlay.
  - [`main dashboard.html`](file:///c:/Users/ASUS/3rd%20Sem%20Project/main%20dashboard.html): Post-registration wholesale dashboard.
- **Backend**: Node.js, Express 5, Prisma ORM 6 (`@prisma/client@6`), PostgreSQL on Neon cloud.
- **Security**: Passwords hashed with `bcrypt` (10 rounds). Protected routes use JWT (`jsonwebtoken`).

---

## 2. Directory Structure

```text
3rd Sem Project/
├── assets/                  # Shared styling, icons, and theme scripts
├── backend/                 # Node.js + Express backend service
│   ├── prisma/
│   │   ├── migrations/      # Version-controlled DB migrations
│   │   └── schema.prisma    # Business & User Prisma schema
│   ├── src/
│   │   ├── middleware/      # authMiddleware.js (JWT validation)
│   │   ├── routes/          # auth.js (register, login, me)
│   │   └── server.js        # Express application entrypoint
│   ├── .env                 # Backend environment variables
│   ├── .gitignore           # Ignores node_modules & local secrets
│   └── package.json         # Backend dependencies & run scripts
├── index.html               # Main landing page
├── registrationPage.html    # Wholesale registration page
├── main dashboard.html      # Protected console dashboard
├── .env                     # Root environment mirror
└── .gitignore               # Root gitignore
```

---

## 3. Database: Neon PostgreSQL & Prisma 6

The database is hosted on **Neon PostgreSQL** (AWS Asia-Pacific / Sydney).

### Models Defined in [`schema.prisma`](file:///c:/Users/ASUS/3rd%20Sem%20Project/backend/prisma/schema.prisma):
1. **`Business`**:
   - `id`: Auto-incrementing integer (Primary Key).
   - `name`: Wholesale business name.
   - `gstNumber`: Unique GSTIN string (validated against Indian 15-character format).
   - `address`: Store / warehouse location.
   - `email`: Unique business contact email.
   - `createdAt`: Timestamp.
   - `users`: Relation (`User[]`).

2. **`User`**:
   - `id`: Auto-incrementing integer (Primary Key).
   - `email`: Admin / login email (Unique).
   - `passwordHash`: Bcrypt hashed password (plain text passwords are never stored or logged).
   - `role`: Role string (`"admin"` by default).
   - `businessId`: Foreign key to `Business.id`.
   - `createdAt`: Timestamp.

---

## 4. Setup & Running the Backend Locally

Follow these steps on any teammate's machine:

### Step 1: Install Node.js Dependencies
Navigate to the `backend/` directory and install the packages:
```bash
cd backend
npm install
```

### Step 2: Environment Variables (`.env`)
Make sure a `.env` file exists in both root and `backend/.env` with the following keys:

> **Note on Neon Cold Starts**: The Neon free tier suspends endpoints after 5 minutes of inactivity. The `&connect_timeout=30` flag prevents connection timeouts when Neon wakes up.

### Step 3: Generate the Prisma Client
Generate the client to match the installed Prisma 6 runtime:
```bash
npx prisma generate
```

### Step 4: Run the Backend Server
Start the development server with live file-watching:
```bash
npm run dev
```
The server will boot and display:
```
Server listening on port 5000
```

---

## 5. Inspecting the Database

You can view, search, and edit records in the Neon database through either of these methods:

### Method A: Prisma Studio (Recommended Graphical UI)
Run Prisma Studio inside `backend/`:
```bash
cd backend
npx prisma studio
```
This opens `http://localhost:5555` in your browser, where you can view all `Business` and `User` records with relationships.

### Method B: Neon Cloud Console
Log in to the [Neon Console](https://console.neon.tech), open the project `ep-dry-cherry-a7klkx0x`, and click **Tables** or **SQL Editor** to run queries directly:
```sql
SELECT * FROM "Business";
SELECT * FROM "User";
```

---

## 6. API Endpoints Reference

Base URL: `http://localhost:5000`

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/register` | Registers a `Business` and owner `User` atomically in a single transaction. Returns HTTP 201 + created records. | No |
| `POST` | `/api/auth/login` | Validates credentials, verifies bcrypt hash, returns a signed JWT token. | No |
| `GET` | `/api/me` | Fetches current user profile and linked business data. | Yes (`Bearer <token>`) |

---

## 7. Frontend Integration

1. Serve the frontend using VS Code **Live Server** (runs on `http://127.0.0.1:5500`).
2. Open [`registrationPage.html`](file:///c:/Users/ASUS/3rd%20Sem%20Project/registrationPage.html).
3. Fill out the form and submit:
   - Displays animated storefront loading overlay with a hovering dollar badge.
   - Sends payload to `http://localhost:5000/api/auth/register`.
   - On success, saves details in `localStorage` and redirects to [`main dashboard.html`](file:///c:/Users/ASUS/3rd%20Sem%20Project/main%20dashboard.html).

