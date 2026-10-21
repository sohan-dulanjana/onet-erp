import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

type SheetPriceSpec = { key: string; materialId: string; thickness: number };

@Injectable()
export class PriceResolverService {
  constructor(private readonly p: PrismaService) {}

  async resolveSheetPrice(materialId: string, thicknessMm: number, sheetSpecId?: string, date = new Date()) {
    const row = await this.p.materialPrice.findFirst({
      where: {
        materialId,
        thicknessMm: { equals: thicknessMm },
        sheetSpecId: sheetSpecId ?? undefined,
        unit: 'SHEET',
        validFrom: { lte: date },
        OR: [{ validTo: null }, { validTo: { gt: date } }],
      },
      orderBy: { validFrom: 'desc' },
      include: { material: true },
    });
    if (!row) throw new NotFoundException(`No effective sheet price for material ${materialId}, thickness ${thicknessMm}mm at ${date.toISOString()}`);
    return row;
  }

  /** Resolve all component sheet prices in one database query instead of one query per component. */
  async resolveSheetPrices(specs: SheetPriceSpec[], sheetSpecId: string, date = new Date()) {
    const unique = [...new Map(specs.map(s => [`${s.materialId}|${s.thickness}`, s])).values()];
    const rows = unique.length ? await this.p.materialPrice.findMany({
      where: {
        unit: 'SHEET', sheetSpecId,
        validFrom: { lte: date },
        AND: [
          { OR: [{ validTo: null }, { validTo: { gt: date } }] },
          { OR: unique.map(s => ({ materialId: s.materialId, thicknessMm: { equals: s.thickness } })) },
        ],
      },
      orderBy: { validFrom: 'desc' },
      include: { material: true },
    }) : [];
    const rowByKey = new Map<string, any>();
    for (const row of rows) {
      const key = `${row.materialId}|${Number(row.thicknessMm)}`;
      if (!rowByKey.has(key)) rowByKey.set(key, row);
    }
    return specs.map(spec => {
      const row = rowByKey.get(`${spec.materialId}|${spec.thickness}`);
      if (!row) throw new NotFoundException(`No effective sheet price for material ${spec.materialId}, thickness ${spec.thickness}mm at ${date.toISOString()}`);
      return { spec, row };
    });
  }

  async resolveFinishRate(code: string, date = new Date()) {
    const row = await this.p.finishRate.findFirst({
      where: { code, validFrom: { lte: date }, OR: [{ validTo: null }, { validTo: { gt: date } }] },
      orderBy: { validFrom: 'desc' },
    });
    if (!row) throw new NotFoundException(`No effective finish rate for ${code} at ${date.toISOString()}`);
    return row;
  }

  /** Resolve all finish codes with one query, keeping the newest effective record per code. */
  async resolveFinishRates(codes: string[], date = new Date()) {
    const uniqueCodes = [...new Set(codes)];
    if (!uniqueCodes.length) return [];
    const rows = await this.p.finishRate.findMany({
      where: { code: { in: uniqueCodes }, validFrom: { lte: date }, OR: [{ validTo: null }, { validTo: { gt: date } }] },
      orderBy: { validFrom: 'desc' },
    });
    const byCode = new Map<string, any>();
    for (const row of rows) if (!byCode.has(row.code)) byCode.set(row.code, row);
    return uniqueCodes.map(code => {
      const row = byCode.get(code);
      if (!row) throw new NotFoundException(`No effective finish rate for ${code} at ${date.toISOString()}`);
      return { code, row };
    });
  }

  async resolveHardwarePrices(items: { hardwareItemId: string; qty: number }[], date = new Date()) {
    if (!items.length) return [];
    const ids = [...new Set(items.map(item => item.hardwareItemId))];
    const [hardwareItems, prices] = await Promise.all([
      this.p.hardwareItem.findMany({ where: { id: { in: ids } } }),
      this.p.hardwarePrice.findMany({
        where: { hardwareItemId: { in: ids }, validFrom: { lte: date }, OR: [{ validTo: null }, { validTo: { gt: date } }] },
        orderBy: { validFrom: 'desc' },
      }),
    ]);
    const itemById = new Map(hardwareItems.map(item => [item.id, item]));
    const priceByItemId = new Map<string, any>();
    for (const price of prices) if (!priceByItemId.has(price.hardwareItemId)) priceByItemId.set(price.hardwareItemId, price);
    return items.map(item => {
      const hardware = itemById.get(item.hardwareItemId);
      if (!hardware || !hardware.isActive) throw new NotFoundException(`Active hardware item not found: ${item.hardwareItemId}`);
      const price = priceByItemId.get(item.hardwareItemId);
      if (!price) throw new NotFoundException(`No effective price for hardware ${hardware.code}`);
      return {
        hardwareItemId: hardware.id, code: hardware.code, name: hardware.name, qty: item.qty,
        unitPrice: price.unitPrice.toString(), lineTotal: price.unitPrice.mul(item.qty).toString(),
        priceId: price.id, currency: price.currency,
      };
    });
  }

  async resolveCostPolicy(policyId?: string) {
    const row = policyId
      ? await this.p.costPolicy.findUnique({ where: { id: policyId } })
      : await this.p.costPolicy.findFirst({ where: { isActive: true }, orderBy: { updatedAt: 'desc' } });
    if (!row || !row.isActive) throw new NotFoundException(policyId ? 'Cost policy not found or inactive' : 'No active cost policy configured');
    return row;
  }
}
