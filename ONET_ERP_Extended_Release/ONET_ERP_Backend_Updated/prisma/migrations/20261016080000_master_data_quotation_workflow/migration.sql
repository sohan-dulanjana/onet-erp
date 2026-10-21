-- Allow multiple effective-dated rows for the same finish rate code.
DROP INDEX IF EXISTS "FinishRate_code_key";
CREATE INDEX IF NOT EXISTS "FinishRate_code_validFrom_validTo_idx" ON "FinishRate"("code", "validFrom", "validTo");

-- Link quotations to customers. Existing customerId is nullable, so existing quotations remain valid.
ALTER TABLE "Quotation" ADD CONSTRAINT "Quotation_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Line-level immutable snapshot for each quotation revision.
CREATE TABLE "QuotationLineItem" (
  "id" TEXT NOT NULL,
  "revisionId" TEXT NOT NULL,
  "lineNo" INTEGER NOT NULL,
  "description" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "unitPrice" DECIMAL(14,4) NOT NULL,
  "total" DECIMAL(16,4) NOT NULL,
  CONSTRAINT "QuotationLineItem_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "QuotationLineItem_revisionId_lineNo_key" ON "QuotationLineItem"("revisionId", "lineNo");
ALTER TABLE "QuotationLineItem" ADD CONSTRAINT "QuotationLineItem_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "QuotationRevision"("id") ON DELETE CASCADE ON UPDATE CASCADE;
