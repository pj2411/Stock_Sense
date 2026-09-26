# StockSense Frontend

React/Vite frontend for the StockSense inventory API. It follows the supplied dark warehouse-control mockup and connects to the backend at `http://localhost:4000/api/v1` by default.

## Run

```bash
cp .env.example .env
npm install
npm run dev
```

Open `http://localhost:3000` after starting the backend. The seeded local login is `admin@stocksense.local` / `ChangeMe123!`.

## Screens

Dashboard, Stock, Move history, Receipts, Delivery, Transfers, Adjustments, Products, Warehouses, Locations, Suppliers, Reorder rules, Audit log, Settings, and authentication/recovery are all wired to the backend API. Stock changes are recorded through adjustment workflows and never mutate inventory balances directly.
