# Swagger Verification Checklist

Open `http://localhost:3000/api/docs` after migration, Prisma generation, seeding, and server startup.

## Master data

1. `GET /api/v1/materials` — confirm ZN_COATED, ZNAL_COATED, STAINLESS_STEEL, ALUMINIUM and thickness lists.
2. `POST /api/v1/materials` → `GET /api/v1/materials/{id}` → `PATCH /api/v1/materials/{id}` → `DELETE /api/v1/materials/{id}` (delete deactivates, preserving references).
3. `POST /api/v1/materials/{id}/thicknesses` and `DELETE /api/v1/materials/{id}/thicknesses/{thicknessId}`.
4. `GET/POST/PATCH/DELETE /api/v1/materials/sheet-specs` and `GET /api/v1/materials/sheet-specs/{id}`.
5. `GET /api/v1/material-prices?current=true`; `GET /api/v1/material-prices/history/{materialId}`; add a later-dated price using `POST /api/v1/material-prices` and confirm the prior record's `validTo` is closed.
6. `GET/POST /api/v1/hardware-items`; update with `PATCH /api/v1/hardware-items/{id}`; add a price using `POST /api/v1/hardware-items/{id}/prices`; check `GET /api/v1/hardware-items/{id}/prices`.
7. `GET /api/v1/finish-rates?current=true`; add a later-dated rate with `POST /api/v1/finish-rates`; check `GET /api/v1/finish-rates/history/POWDER_COAT_TEXTURE`.
8. `GET /api/v1/cost-policies/active`; create or update a policy and confirm only one policy remains active.
9. `GET/POST/PATCH/DELETE /api/v1/suppliers` and `GET /api/v1/suppliers/{id}`.
10. Test all `GET /api/v1/lookups/*` routes for compact dropdown data.

## Database-backed costing

Use IDs from lookup responses. Example body (replace IDs with actual seeded IDs):

```json
{
  "templateCode": "ENCLOSURE_INDOOR",
  "surfaceType": "INDOOR",
  "widthMm": 600,
  "heightMm": 1000,
  "depthMm": 200,
  "materialId": "<ZN_COATED material id>",
  "thicknessMm": 1.5,
  "sheetSpecId": "<STD-1218-2436 sheet spec id>",
  "finishCodes": ["POWDER_COAT_TEXTURE", "PRIMER"],
  "hardwareItems": [{"hardwareItemId":"<METAL_LOCK id>","qty":1}]
}
```

Call `POST /api/v1/costing/calculate-v2`. Confirm the response includes `pricingDate`, `costPolicy`, `priceSnapshot`, component breakdown, and `costsLkr`. Repeat with `priceDate` before and after a price change to confirm effective-date resolution.

## Customer and quotation workflow

1. Create a customer with `POST /api/v1/customers`.
2. Create a quotation with `POST /api/v1/quotations` and a `customerId` plus `lines`, or supply `estimateIds` to create lines from the latest estimate revisions.
3. Retrieve with `GET /api/v1/quotations` and `GET /api/v1/quotations/{id}`.
4. Revise with `POST /api/v1/quotations/{id}/revisions` while the quote is not accepted/cancelled.
5. Issue with `POST /api/v1/quotations/{id}/issue`; then test accept or reject.
6. Download `GET /api/v1/quotations/{id}/pdf` and confirm the browser receives a PDF attachment.

## Reference enclosure checks

The two workbook target totals are 600×1000×200 mm → LKR 25,019.64 and 600×1190×200 mm → LKR 27,914.25. A valid end-to-end comparison must use the exact workbook material/thickness selections, finish sides/coats, hardware quantities, flat beading, and manual labour/transport lines. Do not treat the seeded generic defaults as proof of an exact match; record component-level differences before accepting the totals as regression baselines.
