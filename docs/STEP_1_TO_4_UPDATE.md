# ONET Backend Update — Master Data, Database Costing and Quotations

This update adds the next Phase 1 backend milestone while preserving `POST /api/v1/costing/calculate` and the existing estimate endpoints.

## Included

- Material CRUD, thickness management, and SheetSpec management.
- Effective-dated material prices, history endpoint, and automatic closing of the previous active window.
- Hardware items and effective-dated hardware prices.
- Effective-dated finish rates (multiple historical records per code).
- Cost policies with one active policy at a time.
- Supplier management.
- Database-backed `POST /api/v1/costing/calculate-v2` and resolved price-ID snapshot.
- Frontend lookup endpoints.
- Customer management.
- Quotation creation from manual line items and/or existing estimate IDs, revision, issue, accept/reject, sequential numbering, and PDF endpoint.
- MatDB-based seed data for sheet prices, hardware, primer/powder finish rates, and default cost policy.
- Swagger documentation at `/api/docs`.

## Installation / upgrade

1. Back up the current backend folder and PostgreSQL database.
2. Merge the source files in this update into the existing project. Keep the current `.env` and database credentials.
3. Install the PDF dependency and reconcile the lock file:

   ```bash
   npm install
   ```

4. Generate Prisma Client and apply the migration:

   ```bash
   npx prisma generate
   npx prisma migrate dev
   ```

   The new migration is `20261016080000_master_data_quotation_workflow`. It adds quotation line items, the nullable customer relation, and permits effective-dated FinishRate history.
5. Seed workbook master data:

   ```bash
   npx prisma db seed
   ```

6. Build and test:

   ```bash
   npm run build
   npm test -- --runInBand
   npm run start:dev
   ```

7. Open `http://localhost:3000/api/docs`.

> Do not run `prisma migrate reset` on a database with existing work. Use a backup first and review the migration before applying it to a production database.

## Effective dating rules

- A price is valid when `validFrom <= priceDate` and (`validTo` is null or `validTo > priceDate`).
- Adding a new current price closes the prior open-ended price record at the new `validFrom` timestamp.
- Historical price records should not be edited or deleted after they have been used in a quote. Add a new price record instead.
- Calculation output includes material-price, finish-rate, hardware-price and cost-policy IDs to make estimate snapshots reproducible.

## Seed rates from the workbook

The seed uses the visible `MatDB` values (LKR without VAT):

- ZN-coated enclosure sheets: 0.6 mm 4,506; 0.7 mm 5,142; 0.8 mm 5,947; 1.0 mm 7,350; 1.2 mm 8,750; 1.4 mm 10,250; 1.5 mm 11,000; 2.0 mm 14,700.
- Zn/Al-coated sheets: 0.6 mm 6,006; 0.7 mm 6,642; 0.8 mm 7,447; 1.0 mm 8,850; 1.2 mm 10,250; 1.4 mm 11,750; 1.5 mm 12,500; 2.0 mm 16,200.
- Stainless sheets: 0.6 mm 7,506; 0.7 mm 8,142; 0.8 mm 8,947; 1.0 mm 10,350; 1.2 mm 11,750; 1.4 mm 13,250; 1.5 mm 14,000; 2.0 mm 17,700.
- Aluminium gland plate rates: 0.8 mm 9,750; 2.0 mm 23,750; 3.0 mm 35,600.
- Primer 140 LKR/sq ft; texture powder finish 140 LKR/sq ft; gloss finish 160 LKR/sq ft.
- Default cost policy: 5% sheet wastage, 20% margin, round up to LKR 10.

The workbook does not supply supplier-specific price history, so these seed rows use a generic workbook source and no supplier assignment. Treat them as starting master data and confirm current commercial prices before issuing quotations.

## Important scope notes

- `calculate-v2` resolves effective database prices and returns price IDs, but saving a calculation as an Estimate still requires the frontend or caller to persist the returned `priceSnapshot` and result breakdown.
- Labour, transport, and other manual costs remain optional input amounts because the workbook's five manual cost lines need to be agreed as separate master-data policy fields before they can be fully resolved automatically.
- Optional component formulas that were unclear or inconsistent in the workbook remain inherited from the current costing service; this release does not claim a verified exact match to both workbook quote totals.
- PDF generation uses pdfmake. The server response is `application/pdf`; check that the installed pdfmake package includes its Roboto font files.
- Quotation numbering is `QTN-YYYYMM-NNNN`. For high-concurrency multi-user production, use a database sequence/locking strategy before relying on this count-based numbering implementation.
