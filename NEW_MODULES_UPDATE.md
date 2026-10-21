# ONET ERP extended modules update

## Included

- Versioned formula formats: `GET/POST /api/v1/formula-formats`, draft revisions, publish, and safe formula calculation.
- Safe expression functions: `+ - * / ^`, parentheses, variables, `min`, `max`, `abs`, `ceil`, `floor`, `round`.
- Formula bands: each component can define `formulaBands`, with a `when` condition or `{ "default": true }` fallback. Conditions support `<`, `<=`, `>`, `>=`, `==`, `!=`.
- Effective-dated price bindings: `MATERIAL_PRICE`, `FINISH_RATE`, `HARDWARE_PRICE`. Resolved values are returned as `priceSnapshot` and saved with costing history.
- Saved costing records and immutable revisions: `/api/v1/costing-records`.
- Inventory items, receipts, issues, adjustments, reorder levels and movement ledger: `/api/v1/inventory`.
- Invoice creation from accepted quotations, revisions, issue, paid/void statuses and PDF: `/api/v1/invoices`.
- Invoice line revisions and costing revisions preserve historical snapshots.
- New formula-management, costing-history, inventory and invoice pages.
- Four-dot loading animation and a dark plum / magenta sidebar theme based on the supplied screenshot.

## Formula configuration example

```json
{
  "currency": "LKR",
  "defaultMarginPct": 0.2,
  "roundingIncrement": 10,
  "priceBindings": [
    {
      "key": "sheetRate",
      "source": "MATERIAL_PRICE",
      "materialCode": "ZN_COATED",
      "thicknessInputKey": "sheetThickness",
      "sheetSpecCode": "STD-1218-2436",
      "valueAs": "PRICE_PER_MM2"
    },
    {
      "key": "powderRate",
      "source": "FINISH_RATE",
      "code": "POWDER_COAT_TEXTURE",
      "valueAs": "PRICE_PER_MM2"
    },
    {
      "key": "metalLockPrice",
      "source": "HARDWARE_PRICE",
      "code": "METAL_LOCK"
    }
  ],
  "components": [
    { "code": "PANEL", "name": "Panel material", "quantityFormula": "W*H", "unitCostFormula": "sheetRate", "unit": "mm²" },
    { "code": "LOCKS", "name": "Door locks", "quantityFormula": "lockQty", "unitCostFormula": "metalLockPrice", "unit": "each" },
    {
      "code": "RIB",
      "name": "Rib area",
      "unit": "mm²",
      "formulaBands": [
        { "name": "Small width", "when": { "field": "W", "op": "<=", "value": 400 }, "costFormula": "W*H*sheetRate" },
        { "name": "Default width", "default": true, "costFormula": "(W+30)*H*sheetRate" }
      ]
    }
  ]
}
```

`inputSchema.fields` defines the input variables (for example `W`, `H`, `D`, `sheetThickness`, `lockQty`, and `priceDate`). Price bindings resolve current database prices for the selected effective date; the formula only sees the numeric binding key such as `sheetRate`.

## Workbook review status — do not skip this step

The two newly uploaded workbooks have been reviewed for sheet structure and visible formula content:

- `EnclosureCost(Surface Type - FlatBeading-InOutDoor)vX22.xlsm`: `EnclCost`, `Summary`, `Quote`, `MatDB`, `CalSht`, `CalHW`. The `EnclCost` worksheet has no Excel formulas in its cell grid; the cost values are filled by VBA/macros. It includes extra component areas/costs such as Z-bracket, canopy, earth-bracket, bench, mounting base/ears, glass and glass beading, as well as additional hardware and quote taxes/markup.
- `Free Standingv7.3.xlsm`: `CostEst`, `PUCost`, `Quote`, `CostCal`, `MatDB`, `MasterDB`. It contains extensive worksheet formulas and many conditional/lookup calculations for multiple panel sections, frame, doors, covers, hardware and material selection.

The seed adds these as **DRAFT formula profiles** (`ENC-FLAT-VX22` and `ENC-FREE-STANDING`) so they appear in Formula Management. They are deliberately not published: the first workbook's core component areas are macro-driven, and the second workbook has complex `IF`/`INDEX`/conditional formula logic that must be mapped and regression-tested before it is safe for production quotes. Publishing guessed formulas could underprice or overprice enclosures.

The configurable engine can represent arithmetic formulas, effective-dated price bindings and dimension bands without a backend release. The exact workbook calculations still need to be mapped into that configuration and compared against client-approved sample totals before the new profiles are published. Existing fixed `FLAT_BEADING`, `DICKY_BEADING`, and `SUNK_TYPE` endpoints remain available.

## Install

1. Back up the database and current backend/frontend folders.
2. Copy the updated backend and frontend source folders into your project locations. Keep the existing `.env` / `DATABASE_URL`.
3. From the backend folder:

   ```powershell
   npm install
   npx prisma generate
   npx prisma migrate dev
   npx prisma db seed
   npm run build
   npm test -- --runInBand
   npm run start:dev
   ```

4. From the frontend folder:

   ```powershell
   npm install
   npm run build
   npm run dev
   ```

5. Confirm `VITE_API_BASE_URL` points at the backend (default `http://localhost:3000`).

A new migration is included at `prisma/migrations/20261020090000_formula_inventory_invoices/migration.sql`. Run a database backup before applying it. Do not manually create the tables in addition to running migrations.

## API route summary

- `GET /api/v1/formula-formats`
- `POST /api/v1/formula-formats`
- `GET /api/v1/formula-formats/:id`
- `POST /api/v1/formula-formats/:id/revisions`
- `POST /api/v1/formula-formats/:id/revisions/:revisionId/publish`
- `POST /api/v1/formula-formats/calculate/:revisionId`
- `GET /api/v1/costing-records`, `POST /api/v1/costing-records`, `GET /api/v1/costing-records/:id`, `POST /api/v1/costing-records/:id/revisions`
- `GET /api/v1/inventory`, `POST /api/v1/inventory`, `PATCH /api/v1/inventory/:id`, `GET /api/v1/inventory/:id/movements`, `POST /api/v1/inventory/:id/movements`
- `GET /api/v1/invoices`, `POST /api/v1/invoices/from-quotation/:quotationId`, `GET /api/v1/invoices/:id`, `POST /api/v1/invoices/:id/revisions`, `POST /api/v1/invoices/:id/issue`, `POST /api/v1/invoices/:id/paid`, `POST /api/v1/invoices/:id/void`, `GET /api/v1/invoices/:id/pdf`

## Production notes

- Formula, inventory and invoice endpoints currently follow the existing app's authentication pattern (the supplied Phase 1 app has no complete authentication/authorization guard). Before production use, add authenticated identities and role guards around formula publication, pricing, inventory adjustments, invoice issue/void and accepted quotation actions.
- Invoice creation is restricted to accepted quotations. Paid invoices cannot be voided in this workflow; a credit-note process should be added if required by the client's accounting practice.
- Inventory stock movement is transactional and prevents stock from going below zero, but it is not yet automatically reserved/consumed by a manufacturing order.
