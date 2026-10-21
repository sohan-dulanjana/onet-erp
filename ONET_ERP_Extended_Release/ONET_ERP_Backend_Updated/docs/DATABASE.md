# Database structure

The Prisma schema is the source of truth for the initial relational model.

## Main areas
- Identity: `User`, `Role`, `UserRole`
- Pricing master: `Material`, `MaterialThickness`, `SheetSpec`, `Supplier`, `MaterialPrice`, `HardwareItem`, `HardwarePrice`, `FinishRate`, `CostPolicy`
- Product configuration: `ProductFamily`, `ProductTemplate`, `TemplateRevision`
- Costing history: `Estimate`, `EstimateRevision`
- Quotation history: `Customer`, `Quotation`, `QuotationRevision`
- Traceability: `AuditEvent`

## Key design rules
1. Never overwrite a price row to change a price. Close its validity window and insert a new price version.
2. Published template revisions should be immutable. Draft, validate, test, publish a new revision.
3. `EstimateRevision` stores the full input, price and component snapshots. Do not calculate old estimates using current prices.
4. Use decimal database columns and decimal arithmetic; do not use binary floating point for money.
5. Add database constraints/migrations for non-overlapping price validity windows, positive dimensions/rates, valid percentages, and published revision immutability before production.
6. `QuotationRevision.snapshot` is intended to freeze customer-facing line descriptions, quantities, prices, margin and totals at issue time.
7. Authentication and role guards are not yet implemented in this scaffold.
