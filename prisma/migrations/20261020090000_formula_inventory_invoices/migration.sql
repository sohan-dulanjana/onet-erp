CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'VOID');
CREATE TYPE "InventoryMovementType" AS ENUM ('RECEIPT', 'ISSUE', 'ADJUSTMENT');

CREATE TABLE "InventoryItem" (
  "id" TEXT NOT NULL, "code" TEXT NOT NULL, "name" TEXT NOT NULL, "category" TEXT,
  "unit" TEXT NOT NULL DEFAULT 'each', "quantityOnHand" DECIMAL(16,4) NOT NULL DEFAULT 0,
  "reorderLevel" DECIMAL(16,4) NOT NULL DEFAULT 0, "unitCost" DECIMAL(16,4) NOT NULL DEFAULT 0,
  "location" TEXT, "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InventoryItem_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "InventoryItem_code_key" ON "InventoryItem"("code");
CREATE INDEX "InventoryItem_name_idx" ON "InventoryItem"("name");
CREATE INDEX "InventoryItem_category_idx" ON "InventoryItem"("category");

CREATE TABLE "InventoryMovement" (
  "id" TEXT NOT NULL, "itemId" TEXT NOT NULL, "type" "InventoryMovementType" NOT NULL,
  "quantity" DECIMAL(16,4) NOT NULL, "unitCost" DECIMAL(16,4), "reference" TEXT, "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InventoryMovement_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "InventoryMovement_itemId_createdAt_idx" ON "InventoryMovement"("itemId", "createdAt");
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "Invoice" (
  "id" TEXT NOT NULL, "invoiceNo" TEXT NOT NULL, "quotationId" TEXT NOT NULL,
  "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT', "currency" TEXT NOT NULL DEFAULT 'LKR',
  "issuedAt" TIMESTAMP(3), "dueAt" TIMESTAMP(3), "paidAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Invoice_invoiceNo_key" ON "Invoice"("invoiceNo");
CREATE INDEX "Invoice_quotationId_createdAt_idx" ON "Invoice"("quotationId", "createdAt");
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "Quotation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "InvoiceRevision" (
  "id" TEXT NOT NULL, "invoiceId" TEXT NOT NULL, "revision" INTEGER NOT NULL,
  "snapshot" JSONB NOT NULL, "subtotal" DECIMAL(16,4) NOT NULL, "tax" DECIMAL(16,4) NOT NULL DEFAULT 0,
  "total" DECIMAL(16,4) NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InvoiceRevision_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "InvoiceRevision_invoiceId_revision_key" ON "InvoiceRevision"("invoiceId", "revision");
ALTER TABLE "InvoiceRevision" ADD CONSTRAINT "InvoiceRevision_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "InvoiceLineItem" (
  "id" TEXT NOT NULL, "revisionId" TEXT NOT NULL, "lineNo" INTEGER NOT NULL,
  "description" TEXT NOT NULL, "quantity" DECIMAL(16,4) NOT NULL, "unitPrice" DECIMAL(16,4) NOT NULL,
  "total" DECIMAL(16,4) NOT NULL, CONSTRAINT "InvoiceLineItem_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "InvoiceLineItem_revisionId_lineNo_key" ON "InvoiceLineItem"("revisionId", "lineNo");
ALTER TABLE "InvoiceLineItem" ADD CONSTRAINT "InvoiceLineItem_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "InvoiceRevision"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "CostingRecord" (
  "id" TEXT NOT NULL, "recordNo" TEXT NOT NULL, "formatCode" TEXT NOT NULL, "formatName" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CostingRecord_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CostingRecord_recordNo_key" ON "CostingRecord"("recordNo");
CREATE INDEX "CostingRecord_formatCode_createdAt_idx" ON "CostingRecord"("formatCode", "createdAt");
CREATE TABLE "CostingRecordRevision" (
  "id" TEXT NOT NULL, "recordId" TEXT NOT NULL, "revision" INTEGER NOT NULL,
  "inputSnapshot" JSONB NOT NULL, "priceSnapshot" JSONB NOT NULL, "componentBreakdown" JSONB NOT NULL,
  "costTotal" DECIMAL(16,4) NOT NULL, "sellingPrice" DECIMAL(16,4) NOT NULL,
  "calculationVersion" TEXT NOT NULL, "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CostingRecordRevision_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CostingRecordRevision_recordId_revision_key" ON "CostingRecordRevision"("recordId", "revision");
ALTER TABLE "CostingRecordRevision" ADD CONSTRAINT "CostingRecordRevision_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "CostingRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;
