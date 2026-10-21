# Costing variants added from client Excel workbooks

This update adds a `costingVariant` option to `POST /api/v1/costing/calculate-v2`:

- `FLAT_BEADING` (default; existing behavior)
- `DICKY_BEADING`
- `SUNK_TYPE`

## Workbook-aligned geometry verified against the supplied examples

The geometry tests compare the calculated total component areas with the supplied workbook examples:

- Flat beading, 600 × 1000 × 200 mm: **3,580,284 mm²** when rib width is 130 mm and gland plate area is 128,000 mm².
- Dicky beading, 650 × 1300 × 430 mm: **6,935,084 mm²** when rib width is 150 mm, gland plate area is 351,000 mm², bench area is 100,000 mm², and canopy/bench are enabled.
- Sunk type, 660 × 600 × 250 mm: **2,072,504 mm²** when collar area is 182,240 mm² and cover plate, gland plate, and rib are disabled.

Sunk type uses the workbook-observed base area formula `(W + 2D + 30) × H` and cap area formula `(W + 30) × (D + 55) × 2`. Surface-type base/cap formulas remain `(W + 2D + 50) × H` and `(W + 30) × (D + 65) × 2`.

## Important formula boundary

The provided macro-enabled workbooks store several values in `EnclCost` as macro-generated cached values rather than visible cell formulas. Their exact VBA formulas for gland-plate area, bench area, and sunk collar area cannot be safely inferred from the two supplied example dimensions alone. The app therefore accepts explicit area inputs where needed rather than silently inventing a formula:

- `DICKY_BEADING`: when gland plate or bench is enabled, enter the approved `glandPlateAreaMm2` and `benchAreaMm2` from the client costing sheet. Dicky-beading cost is entered as a separate LKR amount.
- `SUNK_TYPE`: enter `collarAreaMm2`; collar thickness is optional and otherwise defaults to the primary sheet thickness.
- `FLAT_BEADING`: optional `glandPlateAreaMm2` override is available; when omitted, the existing engine fallback remains in use.

This means the example total areas are regression-tested when the workbook's macro-derived areas are supplied. Before using the new formats for production quotations, confirm the area formulas/inputs with the client or share the VBA logic. The other two workbook formats can be added as further variants after they are uploaded.

## API request additions

```json
{
  "costingVariant": "DICKY_BEADING",
  "glandPlateAreaMm2": 351000,
  "benchAreaMm2": 100000,
  "ribWidthMm": 150,
  "dickyBeadingCostLkr": 3900
}
```

For sunk type, use `"costingVariant":"SUNK_TYPE"`, `"collarAreaMm2":182240`, and optionally `"collarThicknessMm":1.5`. Continue sending the existing required material, thickness, sheet-spec, finish, and price-policy fields.
