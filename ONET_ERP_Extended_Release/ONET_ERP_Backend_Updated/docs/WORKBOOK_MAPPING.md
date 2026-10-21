# Workbook mapping notes

Workbook sheets found:
- `EnclCost`: dimensions, material/thickness selections, component areas and hardware choices.
- `Summary`: cost group summary.
- `Quote`: quote line descriptions, costs, margin and roundup selling price.
- `MatDB`: sheet prices and hardware/finish master values.
- `CalSht`: material selection, thickness lookups, sheet rates and component geometry helpers.
- `CalHW`: hardware selection and quantity/cost calculations.

Known issue to resolve:
- `CalSht!F95` checks `<=600` before `<=100`, making the latter branch unreachable. Confirm intended canopy-height bands with the business owner.
- `Summary` labels for hardware and labour appear misaligned with linked values.
- `Quote` contains cost values in cells, so quote history should be persisted in the application, not treated as a live link to the master.
- Workbook calculations rely on VBA/macros; openpyxl can inspect formulas but does not execute Excel VBA or recalculate formula values.

Reference quote values observed in the workbook:
- 600 x 1000 x 200 mm: LKR 25,019.641919966714
- 600 x 1190 x 200 mm: LKR 27,914.249316759626

These totals are regression targets only after all input selections and price master values are reconciled. Test component-by-component, not only totals.
