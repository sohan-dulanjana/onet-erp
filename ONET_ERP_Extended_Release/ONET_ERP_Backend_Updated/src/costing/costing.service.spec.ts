import { CostingService } from './costing.service';

describe('CostingService', () => {
  const svc = new CostingService();
  const base = { templateCode: 'ENC-FLAT', surfaceType: 'INDOOR' as const, widthMm: 600, depthMm: 200, marginPct: 0.2 };
  it('uses the documented cover plate height bands', () => {
    const h599 = svc.calculate({ ...base, heightMm: 599 }) as any;
    const h600 = svc.calculate({ ...base, heightMm: 600 }) as any;
    const h601 = svc.calculate({ ...base, heightMm: 601 }) as any;
    expect(h599.components.find((x: any) => x.name === 'coverPlateMm2').areaMm2).toBe(String((600 - 45) * (599 - 20)));
    expect(h600.components.find((x: any) => x.name === 'coverPlateMm2').areaMm2).toBe(String((600 - 45) * 600));
    expect(h601.components.find((x: any) => x.name === 'coverPlateMm2').areaMm2).toBe(String((600 - 45) * (601 + 20)));
  });
  it('uses SunkType base/cap allowances and collar area instead of a cover plate', () => {
    const result = svc.calculate({ ...base, costingVariant: 'SUNK_TYPE', widthMm: 660, heightMm: 600, depthMm: 250, collarAreaMm2: 182240, includeCoverPlate: false }) as any;
    const area = (name: string) => result.components.find((x: any) => x.name === name).areaMm2;
    expect(area('baseMm2')).toBe('714000');
    expect(area('capMm2')).toBe('420900');
    expect(area('coverPlateMm2')).toBe('0');
    expect(area('collarMm2')).toBe('182240');
  });
  it('adds Dicky beading as a separate fixed LKR line and suppresses flat beading', () => {
    const rates = { baseCapSheetPrice: 11000, doorSheetPrice: 10000, mountingPlateSheetPrice: 11000, coverPlateSheetPrice: 11000, ribSheetPrice: 11000, glandPlateSheetPrice: 11000, powderRatePerSqFt: 0, hardwareTotal: 0 };
    const result = svc.calculate({ ...base, heightMm: 1000, costingVariant: 'DICKY_BEADING', flatBeadingRatePerM: 999, dickyBeadingCostLkr: 3900, rates }) as any;
    expect(result.costsLkr.dickyBeading).toBe('3900');
    expect(result.costsLkr.flatBeading).toBe('0');
    expect(Number(result.costsLkr.totalCost)).toBeGreaterThanOrEqual(3900);
  });
  it('matches the FlatBeading workbook sample total area when its gland plate area is supplied', () => {
    const result = svc.calculate({ ...base, heightMm: 1000, costingVariant: 'FLAT_BEADING', ribWidthMm: 130, glandPlateAreaMm2: 128000 }) as any;
    expect(result.totalAreaMm2).toBe('3580284');
  });
  it('matches the DickyBeading workbook sample total area with VBA areas supplied', () => {
    const result = svc.calculate({ ...base, costingVariant: 'DICKY_BEADING', widthMm: 650, heightMm: 1300, depthMm: 430, ribWidthMm: 150, glandPlateAreaMm2: 351000, benchAreaMm2: 100000, includeCanopy: true, includeBench: true }) as any;
    expect(result.totalAreaMm2).toBe('6935084');
  });
  it('matches the SunkType workbook sample total area', () => {
    const result = svc.calculate({ ...base, costingVariant: 'SUNK_TYPE', widthMm: 660, heightMm: 600, depthMm: 250, collarAreaMm2: 182240, includeCoverPlate: false, includeGlandPlate: false, includeRib: false }) as any;
    expect(result.totalAreaMm2).toBe('2072504');
  });
  it('uses the fixed 1218 x 2436 mm sheet area', () => {
    const result = svc.calculate({ ...base, heightMm: 1000 }) as any;
    expect(result.sheetSpec.areaMm2).toBe('2967048');
  });
  it('returns costed mode when rate inputs are supplied and rounds selling price up to LKR 10', () => {
    const result = svc.calculate({ ...base, heightMm: 1000, rates: {
      baseCapSheetPrice: 11000, doorSheetPrice: 10000, mountingPlateSheetPrice: 11000,
      coverPlateSheetPrice: 11000, ribSheetPrice: 11000, glandPlateSheetPrice: 11000,
      powderRatePerSqFt: 140, hardwareTotal: 1000, labourCost: 500, transportCost: 300,
    } }) as any;
    expect(result.mode).toBe('COSTED_WITH_SUPPLIED_RATES');
    expect(Number(result.costsLkr.sellingPriceRoundedUpTo10) % 10).toBe(0);
    expect(Number(result.costsLkr.totalCost)).toBeGreaterThan(0);
  });
});
