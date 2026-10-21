import { QuotationsService } from './quotations.service';

describe('QuotationsService lifecycle and draft performance', () => {
  const prisma: any = {
    $transaction: jest.fn(async (fn: any, _options?: any) => fn(tx)),
    quotation: { findFirst: jest.fn(), findUnique: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn() },
    quotationRevision: { create: jest.fn() },
    customer: { findUnique: jest.fn() },
    estimate: { findUnique: jest.fn() },
  };
  const tx: any = { quotation: { update: jest.fn() }, quotationRevision: { create: jest.fn() } };
  const pdf: any = { quotation: jest.fn() };
  let service: QuotationsService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.quotation.findFirst.mockResolvedValue(null);
    prisma.quotation.create.mockReset();
    prisma.$transaction.mockImplementation(async (fn: any) => fn(tx));
    service = new QuotationsService(prisma, pdf);
  });

  it('creates a draft and its initial revision in one nested write without an interactive transaction', async () => {
    prisma.quotation.create.mockResolvedValue({ id: 'q1', quotationNo: `QTN-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}-0001`, status: 'DRAFT' });
    const quotation = await service.create({ lines: [{ description: 'Enclosure', quantity: 2, unitPrice: 1000 }] });
    expect(quotation).toMatchObject({ id: 'q1', status: 'DRAFT' });
    expect(prisma.quotation.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        quotationNo: expect.stringMatching(/^QTN-\d{6}-0001$/),
        revisions: expect.objectContaining({ create: expect.objectContaining({
          lineItems: expect.objectContaining({ create: [expect.objectContaining({ quantity: 2, total: 2000 })] }),
        }) }),
      }),
    }));
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('uses the highest existing quotation suffix instead of count + 1', async () => {
    prisma.quotation.findFirst.mockResolvedValue({ quotationNo: `QTN-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}-0007` });
    prisma.quotation.create.mockResolvedValue({ id: 'q8', quotationNo: 'unused-in-mock', status: 'DRAFT' });
    await service.create({ lines: [{ description: 'Enclosure', quantity: 1, unitPrice: 100 }] });
    expect(prisma.quotation.create.mock.calls[0][0].data.quotationNo).toMatch(/-0008$/);
  });

  it('retries after a quotation-number unique conflict', async () => {
    const uniqueConflict = Object.assign(new Error('Unique constraint failed'), { code: 'P2002', meta: { target: ['quotationNo'] } });
    prisma.quotation.create.mockRejectedValueOnce(uniqueConflict).mockResolvedValueOnce({ id: 'q2', quotationNo: 'QTN-202610-0002', status: 'DRAFT' });
    prisma.quotation.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({ quotationNo: `QTN-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}-0001` });
    const quotation = await service.create({ lines: [{ description: 'Enclosure', quantity: 1, unitPrice: 100 }] });
    expect(quotation).toMatchObject({ id: 'q2', status: 'DRAFT' });
    expect(prisma.quotation.create).toHaveBeenCalledTimes(2);
  });

  it('rejects invalid line items before writing', async () => {
    await expect(service.create({ lines: [{ description: ' ', quantity: 1, unitPrice: 100 }] })).rejects.toThrow('Each line requires a description');
    expect(prisma.quotation.create).not.toHaveBeenCalled();
  });


  it('returns a lightweight paginated quotation register projection', async () => {
    prisma.quotation.findMany.mockResolvedValue([]);
    await service.list(undefined, undefined, 1, 50);
    expect(prisma.quotation.findMany).toHaveBeenCalledWith(expect.objectContaining({
      take: 50,
      select: expect.objectContaining({
        quotationNo: true,
        customer: { select: { id: true, code: true, name: true } },
        revisions: { orderBy: { revision: 'desc' }, take: 1, select: { id: true, revision: true, total: true, createdAt: true } },
      }),
    }));
  });

  it('only accepts an issued quotation', async () => {
    prisma.quotation.findUnique.mockResolvedValue({ id: 'q1', status: 'DRAFT' });
    await expect(service.accept('q1')).rejects.toThrow('Only issued quotations can be accepted');
  });
});
