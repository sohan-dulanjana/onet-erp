import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { PdfService } from '../pdf/pdf.service';
@Injectable()
export class InvoicesService {
  constructor(private readonly prisma: PrismaService, private readonly pdf: PdfService) {}
  private get p(): any { return this.prisma as any; }
  list(status?: string, search?: string) {
    return this.p.invoice.findMany({ where: { ...(status ? { status: status as any } : {}), ...(search ? { invoiceNo: { contains: search, mode: 'insensitive' } } : {}) }, include: { quotation: { include: { customer: true } }, revisions: { orderBy: { revision: 'desc' }, take: 1, select: { id: true, revision: true, subtotal: true, tax: true, total: true, createdAt: true } } }, orderBy: { createdAt: 'desc' }, take: 100 });
  }
  async get(id: string) {
    const row = await this.p.invoice.findUnique({ where: { id }, include: { quotation: { include: { customer: true } }, revisions: { orderBy: { revision: 'desc' }, include: { lineItems: { orderBy: { lineNo: 'asc' } } } } } });
    if (!row) throw new NotFoundException('Invoice not found');
    return row;
  }
  private normalizeLines(lines: any[]) {
    if (!Array.isArray(lines) || !lines.length) throw new BadRequestException('At least one invoice line is required');
    const normalized = lines.map((line, i) => {
      const quantity = Number(line.quantity); const unitPrice = Number(line.unitPrice);
      if (!String(line.description ?? '').trim() || !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(unitPrice) || unitPrice < 0) throw new BadRequestException('Each invoice line needs a description, positive quantity and non-negative unit price');
      return { lineNo: i + 1, description: String(line.description).trim(), quantity, unitPrice, total: Number((quantity * unitPrice).toFixed(4)) };
    });
    return { normalized, subtotal: Number(normalized.reduce((s, x) => s + x.total, 0).toFixed(4)) };
  }
  async createFromQuotation(quotationId: string, dto: any = {}) {
    const q = await this.p.quotation.findUnique({ where: { id: quotationId }, include: { revisions: { orderBy: { revision: 'desc' }, take: 1, include: { lineItems: { orderBy: { lineNo: 'asc' } } } } } });
    if (!q) throw new NotFoundException('Quotation not found');
    if (!['ACCEPTED'].includes(q.status)) throw new BadRequestException('An invoice can only be created from an accepted quotation');
    const sourceLines = q.revisions[0]?.lineItems ?? [];
    const lines = dto.lines?.length ? dto.lines : sourceLines.map((x: any) => ({ description: x.description, quantity: x.quantity, unitPrice: x.unitPrice }));
    const calc = this.normalizeLines(lines); const tax = Number(dto.tax ?? 0);
    if (!Number.isFinite(tax) || tax < 0) throw new BadRequestException('Tax must be a non-negative amount');
    const now = new Date(); const prefix = `INV-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}-`;
    const latest = await this.p.invoice.findFirst({ where: { invoiceNo: { startsWith: prefix } }, orderBy: { invoiceNo: 'desc' }, select: { invoiceNo: true } });
    const suffix = Number.parseInt((latest?.invoiceNo ?? '').slice(prefix.length), 10) || 0;
    return this.p.invoice.create({ data: { invoiceNo: `${prefix}${String(suffix + 1).padStart(4, '0')}`, quotationId, status: 'DRAFT', currency: q.currency, dueAt: dto.dueAt ? new Date(dto.dueAt) : null, revisions: { create: { revision: 1, snapshot: { sourceQuotationId: q.id, sourceQuotationNo: q.quotationNo, sourceQuotationRevision: q.revisions[0]?.revision, notes: dto.notes ?? '' }, subtotal: calc.subtotal, tax, total: Number((calc.subtotal + tax).toFixed(4)), lineItems: { create: calc.normalized } } } }, include: { quotation: { include: { customer: true } }, revisions: { include: { lineItems: true } } } });
  }
  async revise(id: string, dto: any) {
    const invoice = await this.get(id);
    if (['PAID', 'VOID'].includes(invoice.status)) throw new BadRequestException(`Cannot revise a ${invoice.status.toLowerCase()} invoice`);
    const calc = this.normalizeLines(dto.lines); const tax = Number(dto.tax ?? invoice.revisions[0]?.tax ?? 0);
    if (!Number.isFinite(tax) || tax < 0) throw new BadRequestException('Tax must be a non-negative amount');
    const revision = (invoice.revisions[0]?.revision ?? 0) + 1;
    return this.p.$transaction(async (tx: any) => {
      await tx.invoice.update({ where: { id }, data: { status: 'DRAFT', issuedAt: null, paidAt: null, ...(dto.dueAt ? { dueAt: new Date(dto.dueAt) } : {}) } });
      return tx.invoiceRevision.create({ data: { invoiceId: id, revision, snapshot: { ...(invoice.revisions[0]?.snapshot as any ?? {}), notes: dto.notes ?? (invoice.revisions[0]?.snapshot as any)?.notes ?? '', revisedFromRevision: invoice.revisions[0]?.revision ?? null }, subtotal: calc.subtotal, tax, total: Number((calc.subtotal + tax).toFixed(4)), lineItems: { create: calc.normalized } }, include: { lineItems: true } });
    });
  }
  async issue(id: string) {
    const row = await this.get(id);
    if (row.status !== 'DRAFT' || !row.revisions.length) throw new BadRequestException('Only a draft invoice with a revision can be issued');
    return this.p.invoice.update({ where: { id }, data: { status: 'ISSUED', issuedAt: new Date() }, include: { quotation: { include: { customer: true } }, revisions: { orderBy: { revision: 'desc' }, take: 1, include: { lineItems: true } } } });
  }
  async markPaid(id: string) {
    const row = await this.get(id);
    if (!['ISSUED', 'PARTIALLY_PAID'].includes(row.status)) throw new BadRequestException('Only an issued invoice can be marked paid');
    return this.p.invoice.update({ where: { id }, data: { status: 'PAID', paidAt: new Date() } });
  }
  async void(id: string) {
    const row = await this.get(id);
    if (row.status === 'PAID') throw new BadRequestException('A paid invoice cannot be voided here; use a credit-note workflow');
    return this.p.invoice.update({ where: { id }, data: { status: 'VOID' } });
  }
  async pdfBuffer(id: string) {
    const row = await this.get(id); const rev = row.revisions[0];
    return this.pdf.quotation({ ...row, customer: row.quotation?.customer, quotationNo: row.invoiceNo, status: row.status, revisions: rev ? [{ ...rev, total: rev.total, snapshot: { terms: `Invoice linked to quotation ${row.quotation.quotationNo}. ${String((rev.snapshot as any)?.notes ?? '')}` } }] : [] });
  }
}
