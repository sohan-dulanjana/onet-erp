import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateQuotationDto, ReviseQuotationDto } from './dto/quotation.dto';
import { PdfService } from '../pdf/pdf.service';

@Injectable()
export class QuotationsService {
  constructor(private readonly p: PrismaService, private readonly pdf: PdfService) {}

  private calc(lines: { description: string; quantity: number; unitPrice: number }[]) {
    const normalized = lines.map((line, index) => ({
      lineNo: index + 1,
      description: line.description.trim(),
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      total: Number((line.quantity * line.unitPrice).toFixed(4)),
    }));
    const subtotal = normalized.reduce((sum, line) => sum + line.total, 0);
    return { normalized, subtotal: Number(subtotal.toFixed(4)), total: Number(subtotal.toFixed(4)) };
  }

  private isQuotationNumberConflict(error: any): boolean {
    // P2002 is a unique-constraint conflict. Only retry quotation-number conflicts;
    // P2034 means the transaction was rolled back due to a write conflict/deadlock.
    if (error?.code === 'P2034') return true;
    if (error?.code !== 'P2002') return false;
    const target = error?.meta?.target;
    const targetText = Array.isArray(target) ? target.join(',') : String(target ?? '');
    return /quotationNo|quotation_no|quotation\.quotationNo/i.test(targetText);
  }

  private async nextQuotationNumber(tx: any, prefix: string): Promise<string> {
    // Do not use count + 1: deleted/voided records or gaps can make that number
    // already exist. Read the highest suffix and increment it instead.
    const latest = await tx.quotation.findFirst({
      where: { quotationNo: { startsWith: prefix } },
      orderBy: { quotationNo: 'desc' },
      select: { quotationNo: true },
    });
    const suffix = latest?.quotationNo?.startsWith(prefix)
      ? Number.parseInt(latest.quotationNo.slice(prefix.length), 10)
      : 0;
    const next = Number.isFinite(suffix) && suffix >= 0 ? suffix + 1 : 1;
    return `${prefix}${String(next).padStart(4, '0')}`;
  }

  async list(status?: string, search?: string, page = 1, limit = 50) {
    const safePage = Math.max(1, Number.isFinite(page) ? Math.floor(page) : 1);
    const safeLimit = Math.min(100, Math.max(1, Number.isFinite(limit) ? Math.floor(limit) : 50));
    return (this.p as any).quotation.findMany({
      where: {
        ...(status ? { status: status as any } : {}),
        ...(search ? { quotationNo: { contains: search.trim(), mode: 'insensitive' } } : {}),
      },
      // The register only needs these fields. Do not load full customer rows or revision snapshots here.
      select: {
        id: true, quotationNo: true, status: true, currency: true, createdAt: true,
        customer: { select: { id: true, code: true, name: true } },
        revisions: { orderBy: { revision: 'desc' }, take: 1, select: { id: true, revision: true, total: true, createdAt: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (safePage - 1) * safeLimit,
      take: safeLimit,
    });
  }

  async get(id: string) {
    const quotation = await (this.p as any).quotation.findUnique({
      where: { id },
      include: {
        customer: true,
        revisions: { orderBy: { revision: 'desc' }, include: { lineItems: { orderBy: { lineNo: 'asc' } } } },
      },
    });
    if (!quotation) throw new NotFoundException('Quotation not found');
    return quotation;
  }

  async create(dto: CreateQuotationDto) {
    const lines = [...(dto.lines ?? [])];
    const estimateIds = [...(dto.estimateIds ?? []), ...(dto.estimateId ? [dto.estimateId] : [])];

    for (const estimateId of estimateIds) {
      const estimate = await this.p.estimate.findUnique({
        where: { id: estimateId },
        include: { revisions: { orderBy: { revision: 'desc' }, take: 1 } },
      });
      if (!estimate) throw new NotFoundException(`Estimate not found: ${estimateId}`);
      const latest = estimate.revisions[0];
      if (!latest) throw new BadRequestException(`Estimate ${estimate.estimateNo} has no calculated revision`);
      lines.push({ description: `${estimate.estimateNo} - enclosure estimate`, quantity: 1, unitPrice: Number(latest.sellingPrice) });
    }

    if (!lines.length) throw new BadRequestException('Provide line items or at least one estimateId');
    if (lines.some(line => !line.description?.trim() || !Number.isInteger(line.quantity) || line.quantity < 1 || !Number.isFinite(line.unitPrice) || line.unitPrice < 0)) {
      throw new BadRequestException('Each line requires a description, a positive integer quantity and a non-negative unit price');
    }

    const customerId = dto.customerId?.trim() || undefined;
    if (customerId && !(await (this.p as any).customer.findUnique({ where: { id: customerId } }))) {
      throw new NotFoundException('Customer not found');
    }

    const now = new Date();
    const prefix = `QTN-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}-`;
    const calculated = this.calc(lines);

    // A unique-number collision can happen when two users create quotations at
    // nearly the same time. Retry with a freshly resolved number instead of
    // returning a 500 to the first user.
    const maxAttempts = 4;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        // A nested Prisma create is atomic by itself. Avoid an interactive
        // transaction here: cold starts / slow local PostgreSQL can exceed
        // Prisma's 5s interactive transaction timeout even for a valid draft.
        const quotationNo = await this.nextQuotationNumber(this.p, prefix);
        return await (this.p as any).quotation.create({
          data: {
            quotationNo,
            ...(customerId ? { customerId } : {}),
            status: 'DRAFT',
            currency: 'LKR',
            revisions: {
              create: {
                revision: 1,
                subtotal: calculated.subtotal,
                total: calculated.total,
                snapshot: { terms: dto.terms ?? '', estimateIds, createdFrom: estimateIds.length ? 'estimate' : 'manual' },
                lineItems: { create: calculated.normalized },
              },
            },
          },
          include: { customer: true, revisions: { include: { lineItems: true } } },
        });
      } catch (error) {
        if (attempt === maxAttempts || !this.isQuotationNumberConflict(error)) throw error;
      }
    }
    // The loop always returns or throws; this is a defensive guard for TypeScript.
    throw new BadRequestException('Could not allocate a quotation number. Please try again.');
  }

  async revise(id: string, dto: ReviseQuotationDto) {
    const quotation = await this.get(id);
    if (['ACCEPTED', 'CANCELLED'].includes(quotation.status)) {
      throw new BadRequestException(`Cannot revise a ${quotation.status.toLowerCase()} quotation`);
    }
    if (!dto.lines?.length) throw new BadRequestException('At least one quotation line is required');
    const revision = (quotation.revisions[0]?.revision ?? 0) + 1;
    const calculated = this.calc(dto.lines);
    return this.p.$transaction(async tx => {
      await (tx as any).quotation.update({ where: { id }, data: { status: 'DRAFT', issuedAt: null } });
      return (tx as any).quotationRevision.create({
        data: {
          quotationId: id,
          revision,
          subtotal: calculated.subtotal,
          total: calculated.total,
          snapshot: { terms: dto.terms ?? quotation.revisions[0]?.snapshot?.['terms'] ?? '', revisedFromRevision: quotation.revisions[0]?.revision ?? null },
          lineItems: { create: calculated.normalized },
        },
        include: { lineItems: true },
      });
    });
  }

  async issue(id: string) {
    // Avoid loading every revision and every line item just to validate status.
    const quotation = await (this.p as any).quotation.findUnique({
      where: { id }, select: { id: true, status: true, revisions: { take: 1, select: { id: true } } },
    });
    if (!quotation) throw new NotFoundException('Quotation not found');
    if (quotation.status !== 'DRAFT') throw new BadRequestException('Only draft quotations can be issued');
    if (!quotation.revisions.length) throw new BadRequestException('Quotation has no revision');
    return (this.p as any).quotation.update({
      where: { id }, data: { status: 'ISSUED', issuedAt: new Date() },
      include: { customer: true, revisions: { orderBy: { revision: 'desc' }, take: 1, include: { lineItems: { orderBy: { lineNo: 'asc' } } } } },
    });
  }

  async accept(id: string) {
    const quotation = await (this.p as any).quotation.findUnique({ where: { id }, select: { id: true, status: true } });
    if (!quotation) throw new NotFoundException('Quotation not found');
    if (quotation.status !== 'ISSUED') throw new BadRequestException('Only issued quotations can be accepted');
    return (this.p as any).quotation.update({ where: { id }, data: { status: 'ACCEPTED' }, include: { customer: true } });
  }

  async reject(id: string) {
    const quotation = await (this.p as any).quotation.findUnique({ where: { id }, select: { id: true, status: true } });
    if (!quotation) throw new NotFoundException('Quotation not found');
    if (quotation.status !== 'ISSUED') throw new BadRequestException('Only issued quotations can be rejected');
    return (this.p as any).quotation.update({ where: { id }, data: { status: 'REJECTED' }, include: { customer: true } });
  }

  async pdfBuffer(id: string) {
    return this.pdf.quotation(await this.get(id));
  }
}
