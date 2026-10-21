# ONET Backend Master Data + Quotation Update

This is an incremental update for the working ONET NestJS backend. It keeps the existing `/api/v1/costing/calculate` endpoint and adds master data, database-backed costing v2, frontend lookups, customer and quotation APIs, and server-side PDF output.

Before installation, back up the current backend and database. Keep your existing `.env`.

See:
- `docs/STEP_1_TO_4_UPDATE.md` — upgrade steps, schema migration, seed values, limitations.
- `docs/SWAGGER_VERIFICATION.md` — Swagger API verification sequence and sample costing-v2 request.

Commands:

```bash
npm install
npx prisma generate
npx prisma migrate dev
npx prisma db seed
npm run build
npm test -- --runInBand
npm run start:dev
```

Swagger: `http://localhost:3000/api/docs`
