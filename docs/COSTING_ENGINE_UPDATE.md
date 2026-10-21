# Costing engine update — integration notes

## Endpoint
`POST /api/v1/costing/calculate` remains unchanged. The request still accepts `templateCode`, `surfaceType`, dimensions and `marginPct`; it now also accepts optional component toggles and a `rates` object.

## Example request
```json
{
  "templateCode": "ENC-FLAT",
  "surfaceType": "INDOOR",
  "widthMm": 600,
  "heightMm": 1000,
  "depthMm": 200,
  "marginPct": 0.2,
  "wastagePct": 0.05,
  "includeCoverPlate": true,
  "includeMountingPlate": true,
  "includeDoor": true,
  "includeRib": true,
  "includeGlandPlate": true,
  "rates": {
    "baseCapSheetPrice": 11000,
    "doorSheetPrice": 10000,
    "mountingPlateSheetPrice": 11000,
    "coverPlateSheetPrice": 11000,
    "ribSheetPrice": 11000,
    "glandPlateSheetPrice": 9750,
    "powderRatePerSqFt": 140,
    "primerRatePerSqFt": 140,
    "hardwareTotal": 3143,
    "labourCost": 2000,
    "transportCost": 2800,
    "otherCost": 0
  }
}
```

The sheet-price fields are prices for one 1218 × 2436 mm sheet. The engine converts those prices to an area rate, applies component area, then applies wastage. Finish rates are LKR per square foot. `hardwareTotal`, labour, transport and other cost are supplied totals.

## Important limitations before production
- Rates are passed in the request for this milestone. The next integration should resolve them from `MaterialPrice`, `HardwarePrice`, `FinishRate` and `CostPolicy` using effective dates, and snapshot the selected price IDs/values.
- The service deliberately does not claim that the supplied rates reproduce the workbook's two reference quotes until all material selections, optional components, hardware quantities, finishing sides and manual cost inputs are provided and reconciled.
- Cover-plate bands match the documented workbook logic: `<600: -20`, `=600: 0`, `601–700: +20`, `701–900: +40`, `901–1200: +60`, `>1200: +80`.
- The workbook canopy formula has an apparent `<=100` typo after the `<=600` band. This update treats that middle band as `<=1000` but flags it for business confirmation.
- Optional-component geometry (gland plate, Z bracket, earth bracket, bench, canopy, mounting base and ears) is provisional where the workbook depends on manual dimensions or selection logic. Validate these before issuing customer quotations.
- Powder coating currently uses the combined enabled component area once. If production policy charges two sides, encode that explicitly in `FinishRate.sides` rather than hiding it in the rate.
- Flat beading length defaults to `2W + 2H`; supply `flatBeadingRatePerM` only when beading is enabled.
- This is a costing-engine integration step, not an authentication or quotation-approval release. Do not expose unrestricted client-supplied rates to ordinary users in production.

## Run
```bash
npm install
npx prisma generate
npm run build
npm test -- --runInBand
```
