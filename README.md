# Numan Cables – API Server

MERN backend for **Numan Cables** (Pakistan cable & wire B2B ecommerce).  
Currency: **PKR** · Timezone: **Asia/Karachi**

## Status

**Phase 1** – Auth + foundation ✅  
**Phase 2** – Categories, products, stock ✅  
**Phase 3** – Orders, payments, ledger (current)

### Phase 3 includes

- Orders with server-side pricing, `NC-YYYY-######` numbers, status timeline
- Stock deduction on placement (configurable) + restore on cancel
- Manual payments (cash / bank / JazzCash / Easypaisa / cheque), partials, overpay → credit
- Receipt numbers `RC-YYYY-######`, void with reversing ledger (no hard delete)
- Customer ledger (debit orders / credit payments), date filters
- Mongo transactions when replica set available; standalone fallback for local MongoDB
- Seed: sample customers + order with partial payment

## Prerequisites

- Node.js 20+
- MongoDB running locally (or Atlas URI in `.env`)

Tests use `mongodb://127.0.0.1:27017/numan_cables_test` by default.  
Set `USE_MEMORY_MONGO=true` to use mongodb-memory-server (needs VC++ redistributable on Windows).

## Setup

```bash
cd server
cp .env.example .env
npm install
npm run seed
npm run dev
```

API: `http://localhost:5000`  
Swagger: `http://localhost:5000/api/docs`  
Health: `http://localhost:5000/api/v1/health`

Default admin (from `.env`):

- Phone: `03001234567` / `+923001234567`
- Password: `Admin@12345`

## Scripts

| Command        | Description              |
|----------------|--------------------------|
| `npm run dev`  | Nodemon development      |
| `npm start`    | Production start         |
| `npm run seed` | Seed admin + catalog     |
| `npm test`     | Jest tests               |
| `npm run lint` | ESLint                   |

## Catalog endpoints

| Method | Path | Access |
|--------|------|--------|
| GET | `/categories` | Public |
| GET | `/categories/slug/:slug` | Public |
| POST/PATCH/DELETE | `/categories` … | Admin |
| GET | `/products` | Public (filters: search, category, minPrice, maxPrice, stockBadge, sort, page) |
| GET | `/products/slug/:slug` | Public (+ related) |
| POST/PATCH/DELETE | `/products` … | Admin |
| POST | `/products/:id/stock` | Admin `{ type: add\|deduct\|set, quantity, reason }` |
| GET | `/products/:id/stock-movements` | Admin |
| GET | `/products/admin/low-stock` | Admin |

Images: `multipart/form-data` field `image` (category) or `images` (product, up to 8). Stored under `/uploads` as WebP.

## Orders / payments / ledger

| Method | Path | Access |
|--------|------|--------|
| POST | `/orders` | Active customer – place order |
| GET | `/orders/mine` | Customer |
| GET | `/orders/mine/:id` | Customer |
| POST | `/orders/mine/:id/cancel` | Customer (pending only) |
| GET | `/orders/admin/all` | Admin |
| POST | `/orders/admin` | Admin create on behalf |
| PATCH | `/orders/admin/:id/status` | Admin |
| POST | `/orders/admin/:id/cancel` | Admin |
| POST | `/payments` | Admin – record payment (`proof` image optional) |
| POST | `/payments/:id/void` | Admin |
| GET | `/payments` · `/payments/mine` | Admin / customer |
| GET | `/ledger/mine` | Customer statement |
| GET | `/ledger/customers/:customerId` | Admin |
| GET | `/ledger` | Admin overall |

**Overpayment policy:** excess goes to `user.creditBalance` + a CREDIT ledger line (not blocked).

## Auth endpoints (`/api/v1/auth`)

| Method | Path | Notes |
|--------|------|--------|
| POST | `/signup` | 4 fields; pending if approval on |
| POST | `/login` | Phone + password; `remember` |
| POST | `/google` | Needs `GOOGLE_CLIENT_ID` |
| POST | `/google/complete-profile` | Phone + shop after first Google login |
| POST | `/refresh` | Cookie `nc_refresh_token` |
| POST | `/logout` | Revoke current refresh |
| POST | `/logout-everywhere` | Auth required |
| GET | `/me` | Current user |
| POST | `/change-password` | Clears `mustChangePassword` |
| POST | `/forgot-password` | Returns WhatsApp link for admin |
| POST | `/otp/send` | Only if `OTP_ENABLED=true` |
| POST | `/otp/verify` | Only if `OTP_ENABLED=true` |
| GET | `/admin/customers/pending` | Admin |
| GET | `/admin/customers/pending/count` | Sidebar badge |
| POST | `/admin/customers/:id/approve` | Admin |
| POST | `/admin/customers/:id/reject` | Admin |
| POST | `/admin/customers` | Create active customer |
| POST | `/admin/customers/:id/reset-password` | Temp password |

## Decisions (Phase 1)

1. **Access token** in `Authorization: Bearer` header; **refresh** in httpOnly cookie `nc_refresh_token` (path `/api/v1/auth`).
2. **Overpayment** (later): goes to customer `creditBalance` (not blocked).
3. **Stock reduce** (later): on order `placement` by default (`STOCK_REDUCE_ON`).
4. **Uploads**: local disk by default; Cloudinary via `UPLOAD_DRIVER`.
5. **Logging**: Winston. **Validation**: Zod.
6. **Google**: optional; set `GOOGLE_CLIENT_ID` to enable.
7. **OTP**: interface ready, disabled until you flip `OTP_ENABLED`.

## Postman

Import `docs/NumanCables.Auth.postman_collection.json`.

## Next phases

2. Products / categories / stock  
3. Orders + payments + ledger  
4. Admin portal (client)  
5. Storefront (client)  
6. Receipts / reports / exports  
7. SEO + polish  
8. Full test suite + docs  
