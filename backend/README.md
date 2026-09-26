# StockSense Backend

Production-structured, hackathon-sized inventory backend for the StockSense warehouse flows in the supplied PDF and UI extraction.

## Stack

Node.js 20+, TypeScript, Express, PostgreSQL, Prisma, Zod, JWT, Argon2, OpenAPI, and Vitest.

## Local setup

```bash
cp .env.example .env
npm install
docker compose up -d postgres
npx prisma generate
npx prisma migrate dev --name init
npm run db:seed
npm run dev
```

PostgreSQL is provided by [docker-compose.yml](./docker-compose.yml) using PostgreSQL 16, database `stocksense`, user `stocksense`, and password `stocksense`. `npm run db:up` uses Docker when available; on macOS without Docker it uses a Homebrew `postgresql@16` service and creates the `stocksense` role/database automatically. If Homebrew PostgreSQL is not installed, run `brew install postgresql@16` once, then rerun `npm run db:up`. Use `npm run db:status` to inspect it and `npm run db:down` to stop it.

The API runs at `http://localhost:4000`. OpenAPI JSON is available at `/api/v1/openapi.json`, with Swagger UI at `/api/v1/docs`.

The seed creates `admin@stocksense.local`, `manager@stocksense.local`, `operator@stocksense.local`, and `auditor@stocksense.local`. Their local password is `ChangeMe123!`; change it before using the system outside a demo environment.

## API surface

Authentication:

`POST /api/v1/auth/register`, `POST /api/v1/auth/login`, `POST /api/v1/auth/refresh`, `POST /api/v1/auth/logout`, `GET /api/v1/auth/me`, and the password recovery trio under `/api/v1/auth/password`.

Catalog and setup:

`products`, `categories`, `uoms`, `warehouses`, `locations`, and `suppliers` support authenticated list/create/update workflows. Product creation accepts optional `openingStock`; it creates an opening balance, opening ledger entry, and audit log in the same database transaction.

Inventory and operations:

`GET /api/v1/inventory`, `GET /api/v1/stock-ledger`, `GET /api/v1/dashboard`, plus header/item/status/validate routes for `receipts`, `deliveries`, `transfers`, and `adjustments`. Delivery follows `DRAFT -> WAITING -> READY -> DONE`; receipts, transfers, and adjustments follow `DRAFT -> READY -> DONE`.

Supporting screens:

`reorder-rules`, `notifications`, and `audit-logs` are available under `/api/v1`.

All list endpoints accept the search fields represented by the UI where applicable. The stock page changes quantities through an adjustment document; there is no arbitrary balance update endpoint.

## Inventory invariants

- `inventory_balances` is current state; `stock_ledger` is append-only history.
- `free_to_use = on_hand - reserved`.
- Receipt, delivery, transfer, and adjustment validation runs inside a database transaction.
- Validation locks the affected inventory rows with `SELECT ... FOR UPDATE`.
- Validation checks document state and is idempotent when a document is already `DONE`.
- Every stock-changing validation writes ledger and audit records.
- Transfer locks source and destination in deterministic location order to reduce deadlock risk.
- Controllers/routes coordinate request parsing only; inventory behavior is centralized in services.

## Tests and checks

```bash
npm run typecheck
npm run build
npm test
```

Unit tests cover the inventory formula and state transitions. The health integration test is database-independent. Full receipt/delivery/transfer/adjustment integration tests should be run against a disposable PostgreSQL database using `npm run test:integration` after applying the migration.

## Error format

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
