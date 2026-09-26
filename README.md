# StockSense

![StockSense Dashboard](docs/screenshots/dashboard.png)

![StockSense Login](docs/screenshots/login.png)
StockSense is a warehouse inventory management system built for the supplied StockSense UI flow. It provides a focused workspace for products, stock balances, warehouse locations, receipts, deliveries, transfers, adjustments, reorder rules, notifications, and audit history.

The repository is split into two applications:

- `stocksense-frontend`: React/Vite user interface
- `stocksense-backend`: Express/TypeScript API, Prisma data layer, and PostgreSQL schema

## Features

- JWT access and refresh token authentication
- Argon2 password hashing
- PostgreSQL with Prisma ORM and UUID primary keys
- Zod request validation
- OpenAPI JSON and Swagger UI
- Dashboard, stock, move history, product, warehouse, location, and supplier screens
- Receipt, delivery, transfer, and adjustment workflows
- List and Kanban views for all operational document pages
- Light and dark theme toggle with local persistence
- Demo credentials and repeatable demo seed data
- Append-only stock ledger and audit logs
- Reorder rules and notifications
- Transactional stock validation with row locking

## Architecture

```text
React/Vite frontend :3000
          |
          | REST / JSON / JWT
          v
Express TypeScript API :4000
          |
          | Prisma
          v
PostgreSQL :5432
```

The frontend never connects directly to PostgreSQL. All data access goes through the backend API. Inventory is changed only by validating a receipt, delivery, transfer, or adjustment.

## Repository Layout

The GitHub repository should use a layout similar to this:

```text
stocksense/
├── README.md
├── stocksense-frontend/
│   ├── src/
│   ├── .env.example
│   └── package.json
└── stocksense-backend/
    ├── prisma/
    ├── src/
    ├── tests/
    ├── .env.example
    └── package.json
```

## Requirements

- Node.js 20 or newer
- npm
- PostgreSQL 16 or newer
- Docker Desktop is optional on macOS; the backend can use Homebrew PostgreSQL when Docker is unavailable

## Local Setup

### 1. Start PostgreSQL and the backend

Open a terminal in the backend directory:

```bash
cd stocksense-backend
cp .env.example .env
npm install
npm run db:up
npm run db:deploy
npm run db:seed
npm run dev
```

The API will be available at `http://localhost:4000`.

`npm run db:up` uses Docker when available. On macOS without Docker, install PostgreSQL once and run the same command:

```bash
brew install postgresql@16
npm run db:up
```

Useful database commands:

```bash
npm run db:status
npm run db:deploy
npm run db:seed
npm run db:studio
npm run db:down
```

### 2. Start the frontend

Open a second terminal:

```bash
cd stocksense-frontend
cp .env.example .env
npm install
npm run dev
```

Open `http://localhost:3000`.

The frontend uses this API URL by default:

```env
VITE_API_URL=http://localhost:4000/api/v1
```

### 3. Demo credentials

The seed creates these accounts. All use the password `ChangeMe123!`.

| Role | Email |
| --- | --- |
| Admin | `admin@stocksense.local` |
| Manager | `manager@stocksense.local` |
| Operator | `operator@stocksense.local` |
| Auditor | `auditor@stocksense.local` |

The login page displays these credentials and allows selecting an account directly.

The seed creates 20 products, 20 receipts, 20 deliveries, 20 transfers, 20 adjustments, 20 suppliers, warehouse locations, opening balances, ledger entries, reorder rules, and notification data. The seed uses stable references and is safe to run repeatedly.

## Services and Documentation

| Service | URL |
| --- | --- |
| Frontend | `http://localhost:3000` |
| Backend health | `http://localhost:4000/health` |
| OpenAPI JSON | `http://localhost:4000/api/v1/openapi.json` |
| Swagger UI | `http://localhost:4000/api/v1/docs` |
| PostgreSQL | `localhost:5432` |

## API

Base URL:

```text
http://localhost:4000/api/v1
```

Protected requests use:

```http
Authorization: Bearer <accessToken>
Content-Type: application/json
```

Successful responses use this envelope:

```json
{
  "success": true,
  "data": {}
}
```

Errors use this envelope:

```json
{
  "success": false,
  "error": {
    "code": "INSUFFICIENT_STOCK",
    "message": "Delivery quantity exceeds free stock",
    "details": {}
  }
}
```

### Authentication

| Method | Route | Auth |
| --- | --- | --- |
| `POST` | `/auth/register` | Public |
| `POST` | `/auth/login` | Public |
| `POST` | `/auth/refresh` | Refresh token |
| `POST` | `/auth/logout` | Refresh token |
| `GET` | `/auth/me` | Required |
| `POST` | `/auth/password/forgot` | Public |
| `POST` | `/auth/password/verify-otp` | Public |
| `POST` | `/auth/password/reset` | Reset token |

Login request:

```json
{
  "email": "admin@stocksense.local",
  "password": "ChangeMe123!"
}
```

Login response data contains `user`, `accessToken`, and `refreshToken`.

### Catalog and setup

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/products` | List/search products |
| `GET` | `/products/:id` | Get one product |
| `POST` | `/products` | Create product, optionally with opening stock |
| `PATCH` | `/products/:id` | Update product |
| `GET` | `/categories` | List categories |
| `POST` | `/categories` | Create category |
| `PATCH` | `/categories/:id` | Update category |
| `GET` | `/uoms` | List units of measure |
| `POST` | `/uoms` | Create unit of measure |
| `PATCH` | `/uoms/:id` | Update unit of measure |
| `GET` | `/warehouses` | List warehouses |
| `POST` | `/warehouses` | Create warehouse |
| `PATCH` | `/warehouses/:id` | Update warehouse |
| `GET` | `/locations` | List warehouse locations |
| `POST` | `/locations` | Create location |
| `PATCH` | `/locations/:id` | Update location |
| `GET` | `/suppliers` | List suppliers |
| `POST` | `/suppliers` | Create supplier |
| `PATCH` | `/suppliers/:id` | Update supplier |
| `POST` | `/inventory/opening` | Create opening stock record and ledger entry |

Product creation accepts an optional opening stock object:

```json
{
  "sku": "DESK-001",
  "name": "Desk",
  "unitCost": 10.99,
  "categoryId": "<category-uuid>",
  "uomId": "<uom-uuid>",
  "openingStock": {
    "locationId": "<location-uuid>",
    "quantity": 25
  }
}
```

### Inventory and dashboard

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/inventory` | Current inventory balances |
| `GET` | `/stock-ledger` | Historical stock movements |
| `GET` | `/dashboard` | Dashboard totals, document counts, and low stock |

Supported query filters include `productId`, `locationId`, `referenceType`, and `search` where applicable.

Inventory rules:

```text
free_to_use = on_hand - reserved
```

`inventory_balances` is current state. `stock_ledger` is append-only history.

### Receipts

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/receipts` | List/search receipts |
| `GET` | `/receipts/:id` | Get receipt details |
| `POST` | `/receipts` | Create receipt header |
| `POST` | `/receipts/:id/items` | Add or update a receipt item |
| `POST` | `/receipts/:id/ready` | Move Draft to Ready |
| `POST` | `/receipts/:id/cancel` | Cancel receipt |
| `POST` | `/receipts/:id/validate` | Receive stock and mark Done |

Workflow:

```text
Create -> Add items -> Ready -> Validate -> Done
```

### Deliveries

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/deliveries` | List/search deliveries |
| `GET` | `/deliveries/:id` | Get delivery details |
| `POST` | `/deliveries` | Create delivery header |
| `POST` | `/deliveries/:id/items` | Add or update a delivery item |
| `POST` | `/deliveries/:id/pick` | Move Draft to Waiting |
| `POST` | `/deliveries/:id/pack` | Move Waiting to Ready |
| `POST` | `/deliveries/:id/cancel` | Cancel delivery |
| `POST` | `/deliveries/:id/validate` | Ship stock and mark Done |

Workflow:

```text
Create -> Add items -> Pick -> Pack -> Validate -> Done
```

### Transfers

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/transfers` | List/search transfers |
| `GET` | `/transfers/:id` | Get transfer details |
| `POST` | `/transfers` | Create transfer header |
| `POST` | `/transfers/:id/items` | Add or update a transfer item |
| `POST` | `/transfers/:id/ready` | Move Draft to Ready |
| `POST` | `/transfers/:id/validate` | Move stock between locations and mark Done |

Workflow:

```text
Create -> Add items -> Ready -> Validate -> Done
```

### Adjustments

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/adjustments` | List/search adjustments |
| `GET` | `/adjustments/:id` | Get adjustment details |
| `POST` | `/adjustments` | Create adjustment header |
| `POST` | `/adjustments/:id/items` | Add counted quantity |
| `POST` | `/adjustments/:id/ready` | Move Draft to Ready |
| `POST` | `/adjustments/:id/validate` | Apply count difference and mark Done |

Adjustment calculation:

```text
difference = counted_quantity - system_quantity
```

### Planning, notifications, and audit

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/reorder-rules` | List reorder thresholds |
| `POST` | `/reorder-rules` | Create reorder rule |
| `PATCH` | `/reorder-rules/:id` | Update reorder rule |
| `DELETE` | `/reorder-rules/:id` | Delete reorder rule |
| `GET` | `/notifications` | List notifications |
| `PATCH` | `/notifications/:id/read` | Mark notification read |
| `GET` | `/audit-logs` | List audit records |

## Stock Safety Rules

- All primary keys are UUIDs.
- Product SKU is unique.
- Product/location inventory balance is unique.
- A warehouse owns its locations.
- Products reference a category and unit of measure.
- Receipts, deliveries, transfers, and adjustments use header/item tables.
- The stock ledger is append-only.
- There is no direct arbitrary inventory update endpoint.
- Stock-changing validations use database transactions.
- Affected inventory rows are locked before quantity updates.
- Document states are checked before transitions.
- Repeated validation of a `DONE` document is idempotent.
- Every validated stock change writes a ledger entry and audit log.
- Opening stock creates an opening balance and an `OPENING` ledger entry.

## Frontend Screens

The frontend routes are:

```text
/login
/
/stock
/move-history
/receipts
/deliveries
/transfers
/adjustments
/products
/warehouses
/locations
/suppliers
/reorder-rules
/audit-logs
/settings
```

The operations pages support both List and Kanban views. Kanban columns are derived from the API document status and display friendly labels such as Pending, Picking, Packed, Shipped, Received, Completed, Validated, and Cancelled.

## Development Commands

### Backend

```bash
npm run dev              # Start API in watch mode
npm run build            # Compile TypeScript
npm run typecheck        # TypeScript checks
npm test                 # Run all tests
npm run test:unit        # Unit tests
npm run test:integration # PostgreSQL integration tests
npm run db:generate      # Generate Prisma client
npm run db:deploy        # Apply committed migrations
npm run db:seed          # Seed local demo data
npm run docs:export      # Export openapi.json
```

### Frontend

```bash
npm run dev      # Start Vite development server
npm run build    # Typecheck and production build
npm run preview  # Serve the production build locally
```

## Environment Variables

Backend `.env`:

```env
NODE_ENV=development
PORT=4000
DATABASE_URL=postgresql://stocksense:stocksense@localhost:5432/stocksense?schema=public
JWT_ACCESS_SECRET=replace-with-a-long-access-secret
JWT_REFRESH_SECRET=replace-with-a-long-refresh-secret
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=30d
OTP_TTL_MINUTES=10
APP_ORIGIN=http://localhost:3000
```

Frontend `.env`:

```env
VITE_API_URL=http://localhost:4000/api/v1
```

Never commit real `.env` files, JWT secrets, database passwords, or production credentials.

## Troubleshooting

### `docker: command not found`

Docker is optional. Install PostgreSQL with Homebrew and use the backend helper:

```bash
brew install postgresql@16
cd stocksense-backend
npm run db:up
```

### Prisma `P1001: Can't reach database server`

Check PostgreSQL and the environment file:

```bash
npm run db:status
cat .env | grep DATABASE_URL
npm run db:deploy
```

### Frontend cannot reach the API

Confirm both servers are running and that `stocksense-frontend/.env` points to:

```env
VITE_API_URL=http://localhost:4000/api/v1
```

Then restart Vite after changing environment variables.

## License

This project was created as a hackathon implementation for StockSense.
