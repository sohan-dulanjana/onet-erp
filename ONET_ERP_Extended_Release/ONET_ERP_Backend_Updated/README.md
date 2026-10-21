# ONET Phase 1 Backend Starter

Starter backend for the ONET enclosure costing and quotation system.

## Stack
- Node.js 22+, NestJS, TypeScript
- PostgreSQL
- Prisma ORM
- Decimal.js for calculation arithmetic
- Swagger/OpenAPI
- Jest for tests

## Important
This is a runnable **starter scaffold**, not a production-ready system. The workbook's VBA-driven calculation path, all component formulas, and all `MatDB` price rows must be fully reconciled before using it to issue real quotations. Do not treat placeholder template formulas as authoritative.

## Run
1. Install Node.js 22+ and PostgreSQL.
2. Copy `.env.example` to `.env` and set `DATABASE_URL`.
3. `npm install`
4. `npx prisma generate`
5. `npx prisma migrate dev --name init`
6. `npm run start:dev`
7. Open `http://localhost:3000/api/docs`

## Endpoints included
- `GET /api/health`
- `POST /api/v1/costing/calculate` — preview calculation using a deliberately small, configurable component model.
- `POST /api/v1/estimates` — save an estimate input/result snapshot.
- `GET /api/v1/estimates/:id` — read saved estimate.

## Workbook observations
The supplied workbook has sheets `EnclCost`, `Summary`, `Quote`, `MatDB`, `CalSht`, and `CalHW`. `MatDB` includes sheet prices for Zn coated, Zn/Al coated and stainless steel, aluminium gland-plate prices, finishing rates, and hardware/accessory prices. `CalSht` and `CalHW` are calculation/helper sheets. The canopy band condition in `CalSht!F95` must be clarified because the workbook tests `<=600` before `<=100`, making the latter branch unreachable.

## Production hardening still required
- Complete and verify every component formula from the workbook and VBA.
- Build a reviewed MatDB import with effective dates and currency/units.
- Add authentication, RBAC guards, rate limiting, request validation, structured logging, backups, deployment/CI, audit policies, and integration tests.
- Make published template revisions immutable and store the full calculation input, component breakdown, prices, and formula revision with each estimate.
- Add customer and quotation revision workflows and PDF rendering.
- Add transactional imports, duplicate detection, dry-run validation, and an import report.

## Master data + quotation update

The current update adds effective-dated master data APIs, database-backed costing at `POST /api/v1/costing/calculate-v2`, lookup endpoints, customer CRUD, quotation lifecycle APIs, and PDF generation. See `docs/STEP_1_TO_4_UPDATE.md` for upgrade instructions and `docs/SWAGGER_VERIFICATION.md` for manual verification.

Upgrade sequence: back up the database, merge files, run `npm install`, `npx prisma generate`, `npx prisma migrate dev`, `npx prisma db seed`, `npm run build`, and `npm test -- --runInBand`. Keep the current `.env` file.

## Extended modules

See `NEW_MODULES_UPDATE.md` for versioned formula formats, costing history, inventory, invoices, migration instructions, API endpoints, and the important review status of the newly uploaded workbook profiles.
