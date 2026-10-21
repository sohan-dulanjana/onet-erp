import { PriceResolverService } from './price-resolver.service';

describe('PriceResolverService', () => {
  const prisma: any = {
    materialPrice: { findFirst: jest.fn(), findMany: jest.fn() },
    finishRate: { findFirst: jest.fn(), findMany: jest.fn() },
    hardwareItem: { findUnique: jest.fn(), findMany: jest.fn() },
    hardwarePrice: { findMany: jest.fn() },
    costPolicy: { findUnique: jest.fn(), findFirst: jest.fn() },
  };
  let service: PriceResolverService;
  beforeEach(() => { jest.clearAllMocks(); service = new PriceResolverService(prisma); });

  it('resolves sheet price for the requested effective date', async () => {
    prisma.materialPrice.findFirst.mockResolvedValue({ id: 'price1', unitPrice: '11000', material: { code: 'ZN_COATED' } });
    const at = new Date('2026-06-01T00:00:00Z');
    await expect(service.resolveSheetPrice('m1', 1.5, 's1', at)).resolves.toMatchObject({ id: 'price1' });
    expect(prisma.materialPrice.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ materialId: 'm1', validFrom: { lte: at }, OR: [{ validTo: null }, { validTo: { gt: at } }] }) }));
  });

  it('fails clearly when no effective price exists', async () => {
    prisma.materialPrice.findFirst.mockResolvedValue(null);
    await expect(service.resolveSheetPrice('m1', 1, 's1', new Date())).rejects.toThrow('No effective sheet price');
  });

  it('batch-resolves sheet prices with one query and preserves requested component order', async () => {
    const at = new Date('2026-06-01T00:00:00Z');
    prisma.materialPrice.findMany.mockResolvedValue([
      { id: 'p1', materialId: 'm1', thicknessMm: 1, unitPrice: '100', material: { code: 'M1' } },
      { id: 'p2', materialId: 'm2', thicknessMm: 1.5, unitPrice: '200', material: { code: 'M2' } },
    ]);
    const specs = [{ key: 'base', materialId: 'm1', thickness: 1 }, { key: 'door', materialId: 'm2', thickness: 1.5 }, { key: 'cap', materialId: 'm1', thickness: 1 }];
    const rows = await service.resolveSheetPrices(specs, 's1', at);
    expect(prisma.materialPrice.findMany).toHaveBeenCalledTimes(1);
    expect(rows.map(x => x.row.id)).toEqual(['p1', 'p2', 'p1']);
  });

  it('resolves effective finish rates', async () => {
    prisma.finishRate.findFirst.mockResolvedValue({ id: 'finish1', code: 'PRIMER' });
    await expect(service.resolveFinishRate('PRIMER', new Date())).resolves.toMatchObject({ id: 'finish1' });
  });

  it('batch-resolves finish rates in one query', async () => {
    prisma.finishRate.findMany.mockResolvedValue([{ id: 'f1', code: 'POWDER_COAT' }, { id: 'f2', code: 'PRIMER' }]);
    const result = await service.resolveFinishRates(['POWDER_COAT', 'PRIMER', 'POWDER_COAT'], new Date());
    expect(prisma.finishRate.findMany).toHaveBeenCalledTimes(1);
    expect(result.map(x => x.code)).toEqual(['POWDER_COAT', 'PRIMER']);
  });
});
