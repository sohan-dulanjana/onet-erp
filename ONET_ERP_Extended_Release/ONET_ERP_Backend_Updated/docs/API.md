# API contract draft

Prefix: `/api/v1`

| Method | Path | Purpose |
|---|---|---|
| POST | `/costing/calculate` | Validate inputs and return component-level preview |
| POST | `/estimates` | Save an estimate and initial immutable revision |
| GET | `/estimates/:id` | Read estimate and revision history |
| POST | `/estimates/:id/recalculate` | Future: append a new revision using current selected price/template versions |
| GET/POST | `/materials` | Material master |
| GET/POST | `/material-prices` | Effective-dated prices |
| GET/POST | `/hardware-items` | Hardware master |
| GET/POST | `/finish-rates` | Primer/powder coating rates |
| GET/POST | `/cost-policies` | Wastage, margin and rounding rules |
| GET/POST | `/templates` | Product templates |
| POST | `/templates/:id/revisions/:revision/validate` | Validate draft rules |
| POST | `/templates/:id/revisions/:revision/publish` | Publish immutable revision |
| POST | `/quotations` | Create quotation |
| POST | `/quotations/:id/revisions` | Add quotation revision |
| POST | `/quotations/:id/issue` | Freeze and issue quotation |
| GET | `/quotations/:id/pdf` | Render server-side PDF |

The last endpoints are design targets and are not implemented in this scaffold.
