# ONET ERP backend — updated costing variants

This is a complete backend source project (dependencies are not bundled). It includes the earlier master-data, costing, quotation, PDF, transaction and data-loading performance updates plus the new costing variants. See `COSTING_VARIANTS_UPDATE.md` for formula details and known limitations.

## Windows setup

1. Back up your current backend folder and preserve your existing `.env` file.
2. Extract this ZIP to a new folder, or copy its project files into your backend while keeping your `.env`.
3. If needed, copy `.env.example` to `.env` and set `DATABASE_URL` for your PostgreSQL database.
4. Run:

```powershell
npm install
npx prisma generate
npm run build
npm test -- --runInBand
npm run start:dev
```

No new Prisma schema migration is required for the costing-variant update. Keep the database/migrations already applied to your project.
