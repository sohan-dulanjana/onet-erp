import { BadRequestException, Injectable } from '@nestjs/common';
import Decimal from 'decimal.js';
import { CalculateCostDto } from './dto/calculate-cost.dto';
import { CalculateCostV2Dto } from './dto/calculate-cost-v2.dto';
import { PriceResolverService } from './price-resolver.service';
import { PrismaService } from '../prisma.service';

const SHEET_WIDTH_MM = new Decimal(1218);
const SHEET_HEIGHT_MM = new Decimal(2436);
const SHEET_AREA_MM2 = SHEET_WIDTH_MM.times(SHEET_HEIGHT_MM); // 2,967,048
const SQ_FT_MM2 = new Decimal('304.8').pow(2);
const d = (n: number | string | undefined, fallback = 0) => new Decimal(n ?? fallback);

@Injectable()
export class CostingService {
  constructor(private readonly resolver?: PriceResolverService, private readonly prisma?: PrismaService) {}

  async calculateV2(input: CalculateCostV2Dto) {
    if (!this.resolver || !this.prisma) throw new BadRequestException("Database price resolution is not configured");
    const variant = input.costingVariant ?? 'FLAT_BEADING';
    if (variant === 'DICKY_BEADING' && input.includeBench === true && (!Number.isFinite(input.benchAreaMm2) || Number(input.benchAreaMm2) <= 0)) {
      throw new BadRequestException('benchAreaMm2 is required for DICKY_BEADING when Bench is enabled because the workbook stores a VBA-calculated area. Enter the approved area from the client costing sheet.');
    }
    if (variant === 'DICKY_BEADING' && input.includeGlandPlate !== false && (!Number.isFinite(input.glandPlateAreaMm2) || Number(input.glandPlateAreaMm2) <= 0)) {
      throw new BadRequestException('glandPlateAreaMm2 is required for DICKY_BEADING until the VBA gland-plate area formula is confirmed. Enter the approved area from the client costing sheet.');
    }
    if (variant === 'SUNK_TYPE' && (!Number.isFinite(input.collarAreaMm2) || Number(input.collarAreaMm2) <= 0)) {
      throw new BadRequestException('collarAreaMm2 is required for SUNK_TYPE until the collar geometry formula is confirmed from the client workbook. Enter the collar area from the approved costing sheet.');
    }
    const date = input.priceDate ? new Date(input.priceDate) : new Date();
    if (Number.isNaN(date.getTime())) throw new BadRequestException("priceDate must be a valid date");

    // These configuration reads are independent, so perform them in parallel.
    const [policy, standardSheetSpec, aluminum, beading] = await Promise.all([
      this.resolver.resolveCostPolicy(input.costPolicyId),
      input.sheetSpecOverrideId || input.sheetSpecId
        ? Promise.resolve(null)
        : this.prisma.sheetSpec.findUnique({ where: { code: "STD-1218-2436" }, select: { id: true } }),
      input.glandPlateMaterialId
        ? Promise.resolve(null)
        : this.prisma.material.findUnique({ where: { code: "ALUMINIUM" }, select: { id: true } }),
      input.flatBeadingRatePerM === undefined
        ? this.prisma.hardwareItem.findUnique({ where: { code: 'FLAT_BEADING' }, select: { id: true, isActive: true } })
        : Promise.resolve(null),
    ]);
    const sheetSpecId = input.sheetSpecOverrideId ?? input.sheetSpecId ?? standardSheetSpec?.id;
    if (!sheetSpecId) throw new BadRequestException("No sheet specification provided and STD-1218-2436 was not found");

    const specs = [
      { key: "baseCapSheetPrice", materialId: input.materialId, thickness: input.thicknessMm },
      { key: "doorSheetPrice", materialId: input.doorMaterialId ?? input.materialId, thickness: input.doorThicknessMm ?? input.thicknessMm },
      { key: "mountingPlateSheetPrice", materialId: input.mountingPlateMaterialId ?? input.materialId, thickness: input.mountingPlateThicknessMm ?? input.thicknessMm },
      { key: "coverPlateSheetPrice", materialId: input.coverPlateMaterialId ?? input.materialId, thickness: input.coverPlateThicknessMm ?? input.thicknessMm },
      ...(variant === 'SUNK_TYPE' ? [{ key: "collarSheetPrice", materialId: input.collarMaterialId ?? input.materialId, thickness: input.collarThicknessMm ?? input.thicknessMm }] : []),
      { key: "ribSheetPrice", materialId: input.ribMaterialId ?? input.materialId, thickness: input.ribThicknessMm ?? input.thicknessMm },
      { key: "glandPlateSheetPrice", materialId: input.glandPlateMaterialId ?? aluminum?.id ?? input.materialId, thickness: input.glandPlateThicknessMm ?? (aluminum ? 0.8 : input.thicknessMm) },
    ];
    const finishCodes = [...new Set(input.finishCodes ?? [])];
    const requestedHardware = input.hardwareItems ?? [];
    const addAutomaticBeading = variant !== 'DICKY_BEADING' && input.flatBeadingRatePerM === undefined && Boolean(beading?.isActive);
    const hardwareRequests = addAutomaticBeading
      ? [...requestedHardware, { hardwareItemId: beading!.id, qty: 1 }]
      : requestedHardware;
    const [resolvedSheetPrices, resolvedFinishRates, allHardwareLines] = await Promise.all([
      this.resolver.resolveSheetPrices(specs, sheetSpecId, date),
      this.resolver.resolveFinishRates(finishCodes, date),
      this.resolver.resolveHardwarePrices(hardwareRequests, date),
    ]);
    const hardwareLines = allHardwareLines.slice(0, requestedHardware.length);
    const automaticBeadingLine = addAutomaticBeading ? allHardwareLines[requestedHardware.length] : null;

    const priceSnapshot: Record<string, any> = {};
    const rateValues: Record<string, number> = {};
    for (const { spec, row } of resolvedSheetPrices) {
      rateValues[spec.key] = Number(row.unitPrice);
      priceSnapshot[spec.key] = {
        priceId: row.id, materialId: row.materialId, materialCode: row.material.code,
        thicknessMm: row.thicknessMm?.toString() ?? null, sheetSpecId: row.sheetSpecId,
        unitPrice: row.unitPrice.toString(), currency: row.currency, validFrom: row.validFrom.toISOString(),
      };
    }

    let powderRate = 0, primerRate = 0;
    const finishSnapshot: any[] = [];
    for (const { code, row } of resolvedFinishRates) {
      const effectiveRate = Number(row.ratePerSqFt) * row.coats * row.sides;
      if (/PRIMER/i.test(code)) primerRate += effectiveRate; else powderRate += effectiveRate;
      finishSnapshot.push({ id: row.id, code: row.code, name: row.name, ratePerSqFt: row.ratePerSqFt.toString(), coats: row.coats, sides: row.sides, validFrom: row.validFrom.toISOString(), effectiveRatePerSqFt: effectiveRate });
    }

    const hardwareTotal = hardwareLines.reduce((n, x) => n + Number(x.lineTotal), 0);
    let flatBeadingRatePerM = input.flatBeadingRatePerM ?? 0;
    let flatBeadingPriceSnapshot: any = null;
    if (addAutomaticBeading && automaticBeadingLine) {
      flatBeadingRatePerM = Number(automaticBeadingLine.unitPrice);
      flatBeadingPriceSnapshot = { ...automaticBeadingLine, qty: 1, lineTotal: automaticBeadingLine.unitPrice };
    }
    const rates: any = {
      ...rateValues,
      zBracketSheetPrice: rateValues.baseCapSheetPrice, earthBracketSheetPrice: rateValues.baseCapSheetPrice,
      benchSheetPrice: rateValues.baseCapSheetPrice, innerDoorSheetPrice: rateValues.doorSheetPrice,
      canopySheetPrice: rateValues.baseCapSheetPrice, mountingBaseSheetPrice: rateValues.baseCapSheetPrice,
      mountingEarSheetPrice: rateValues.baseCapSheetPrice, powderRatePerSqFt: powderRate, primerRatePerSqFt: primerRate,
      hardwareTotal, labourCost: input.labourCost ?? 0, transportCost: input.transportCost ?? 0, otherCost: input.otherCost ?? 0,
    };
    const legacyInput: CalculateCostDto = { ...input, costingVariant: variant, marginPct: input.marginPct ?? Number(policy.defaultMarginPct), wastagePct: Number(policy.sheetWastagePct), flatBeadingRatePerM, includePrimer: primerRate > 0, rates };
    const result = this.calculate(legacyInput);
    const inc = Number(policy.roundingIncrement);
    const rawSelling = Number(result.costsLkr.totalCost) / (1 - legacyInput.marginPct);
    const roundedSelling = Math.ceil(rawSelling / inc) * inc;
    return {
      ...result, costingVariant: variant, mode: "COSTED_WITH_DATABASE_MASTER_DATA",
      warning: "Prices were resolved from effective-dated database master data. Resolved price IDs are included for estimate snapshotting.",
      pricingDate: date.toISOString(),
      costPolicy: { id: policy.id, code: policy.code, sheetWastagePct: policy.sheetWastagePct.toString(), defaultMarginPct: policy.defaultMarginPct.toString(), roundingIncrement: policy.roundingIncrement.toString() },
      priceSnapshot: { ...priceSnapshot, finishRates: finishSnapshot, hardwareLines, flatBeadingPrice: flatBeadingPriceSnapshot },
      costsLkr: { ...result.costsLkr, marginPct: legacyInput.marginPct, sellingPriceRoundedUpTo10: roundedSelling.toFixed(2), sellingPriceRounded: roundedSelling.toFixed(2), roundingIncrement: inc.toString() },
    };
  }

  calculate(input: CalculateCostDto) {
    this.validateDimensions(input);
    const W = d(input.widthMm), H = d(input.heightMm), D = d(input.depthMm);
    const offset = this.coverOffset(H);
    const ribWidth = d(input.ribWidthMm, 150);
    const glandWidth = d(input.glandPlateWidthMm, W.lte(400) ? 200 : W.lte(800) ? 300 : 400);
    const enabled = (key: keyof CalculateCostDto, defaultValue = true) => (input[key] as boolean | undefined) ?? defaultValue;
    const variant = input.costingVariant ?? 'FLAT_BEADING';
    const isSunk = variant === 'SUNK_TYPE';
    const areas: Record<string, Decimal> = {
      // SunkType workbook has a different base/cap edge allowance than the surface-type workbook.
      baseMm2: (isSunk ? W.plus(D.times(2)).plus(30) : W.plus(D.times(2)).plus(50)).times(H),
      capMm2: W.plus(30).times(D.plus(isSunk ? 55 : 65)).times(2),
      doorMm2: enabled('includeDoor') ? W.plus(28).times(H.plus(28)) : d(0),
      mountingPlateMm2: enabled('includeMountingPlate') ? Decimal.max(0, W.minus(50)).times(Decimal.max(0, H.minus(70))) : d(0),
      coverPlateMm2: !isSunk && enabled('includeCoverPlate') ? Decimal.max(0, W.minus(45)).times(Decimal.max(0, H.plus(offset))) : d(0),
      collarMm2: isSunk ? d(input.collarAreaMm2) : d(0),
      ribMm2: enabled('includeRib') ? d(40).plus(ribWidth).times(Decimal.max(0, H.minus(50))).times(2) : d(0),
      glandPlateMm2: enabled('includeGlandPlate') ? (input.glandPlateAreaMm2 !== undefined ? d(input.glandPlateAreaMm2) : glandWidth.times(Decimal.max(0, D.minus(25)))) : d(0),
      zBracketMm2: enabled('includeZBracket', false) ? d(2).times(80).times(40) : d(0),
      earthBracketMm2: enabled('includeEarthBracket', false) ? d(2).times(60).times(40) : d(0),
      benchMm2: enabled('includeBench', false) ? (input.benchAreaMm2 !== undefined ? d(input.benchAreaMm2) : W.plus(30).times(D.plus(30))) : d(0),
      innerDoorMm2: enabled('includeInnerDoor', false) ? Decimal.max(0, W.minus(45)).times(Decimal.max(0, H.minus(25))) : d(0),
      canopyMm2: enabled('includeCanopy', false) ? this.canopyArea(W, H, D) : d(0),
      mountingBaseMm2: d(0),
      mountingEarsMm2: enabled('includeMountingEars', false) ? d(120 * 60 * 4) : d(0),
    };
    // Correct mounting-base arithmetic as Decimal values (two pairs of side strips).
    areas.mountingBaseMm2 = enabled('includeMountingBase', false)
      ? Decimal.max(0, W.minus(30)).plus(Decimal.max(0, D.minus(25))).times(420).times(2) : d(0);
    for (const [name, area] of Object.entries(areas)) {
      if (!area.isFinite() || area.isNegative()) throw new BadRequestException(`Invalid component area: ${name}`);
    }

    const wastagePct = d(input.wastagePct, 0.05);
    const areaRate = (price: number | undefined) => d(price).div(SHEET_AREA_MM2);
    const rates = input.rates;
    const priced = Boolean(rates);
    const componentPriceMap: Record<string, number | undefined> = {
      baseMm2: rates?.baseCapSheetPrice, capMm2: rates?.baseCapSheetPrice, collarMm2: rates?.collarSheetPrice ?? rates?.coverPlateSheetPrice, doorMm2: rates?.doorSheetPrice,
      mountingPlateMm2: rates?.mountingPlateSheetPrice, coverPlateMm2: rates?.coverPlateSheetPrice,
      ribMm2: rates?.ribSheetPrice, glandPlateMm2: rates?.glandPlateSheetPrice,
      zBracketMm2: rates?.zBracketSheetPrice, earthBracketMm2: rates?.earthBracketSheetPrice,
      benchMm2: rates?.benchSheetPrice, innerDoorMm2: rates?.innerDoorSheetPrice,
      canopyMm2: rates?.canopySheetPrice, mountingBaseMm2: rates?.mountingBaseSheetPrice,
      mountingEarsMm2: rates?.mountingEarSheetPrice,
    };
    const components = Object.entries(areas).map(([name, area]) => {
      const price = area.times(areaRate(componentPriceMap[name]));
      return { name, areaMm2: area.toDecimalPlaces(2).toString(), sheetPriceLkr: price.toDecimalPlaces(4).toString() };
    });
    const rawSheetCost = components.reduce((sum, row) => sum.plus(row.sheetPriceLkr), d(0));
    const sheetCost = rawSheetCost.times(d(1).plus(wastagePct));
    const totalFinishArea = Object.values(areas).reduce((sum, area) => sum.plus(area), d(0));
    const powderCost = priced ? totalFinishArea.div(SQ_FT_MM2).times(rates!.powderRatePerSqFt) : d(0);
    const primerCost = priced && enabled('includePrimer', false)
      ? totalFinishArea.div(SQ_FT_MM2).times(d(rates!.primerRatePerSqFt)) : d(0);
    const beadingLength = d(input.flatBeadingLengthMm, input.widthMm * 2 + input.heightMm * 2);
    const beadingCost = variant === 'DICKY_BEADING' ? d(0) : d(input.flatBeadingRatePerM).times(beadingLength).div(1000);
    const dickyBeadingCost = variant === 'DICKY_BEADING' ? d(input.dickyBeadingCostLkr) : d(0);
    const hardwareCost = d(rates?.hardwareTotal);
    const labourCost = d(rates?.labourCost), transportCost = d(rates?.transportCost), otherCost = d(rates?.otherCost);
    const totalCost = sheetCost.plus(powderCost).plus(primerCost).plus(beadingCost).plus(dickyBeadingCost).plus(hardwareCost).plus(labourCost).plus(transportCost).plus(otherCost);
    const sellingPrice = input.marginPct >= 1 ? d(0) : totalCost.div(d(1).minus(input.marginPct)).div(10).ceil().times(10);
    return {
      costingVariant: variant,
      mode: priced ? 'COSTED_WITH_SUPPLIED_RATES' : 'GEOMETRY_ONLY',
      warning: variant === 'DICKY_BEADING' && input.glandPlateAreaMm2 === undefined
        ? 'Gland plate area was estimated using the legacy geometry rule. For production, enter the approved workbook area; the VBA formula is not embedded as a worksheet formula.'
        : variant === 'SUNK_TYPE'
        ? 'Sunk-type base/cap allowances are applied. Collar area is an explicit input because the workbook stores the area as a VBA-calculated value and its exact formula could not be independently verified; confirm against the client workbook before production use.'
        : variant === 'DICKY_BEADING'
        ? 'Dicky-beading cost is entered as a separate LKR amount, matching the workbook cost line. Confirm its current price and whether glass beading is also required.'
        : priced
        ? 'Costed using rates supplied in this request. Wire these rates to approved, effective-dated master-data records before production use; optional-component dimensions should be confirmed against the workbook.'
        : 'Geometry-only preview. Provide rates to calculate costs; this response is not a quotation.',
      templateCode: input.templateCode, surfaceType: input.surfaceType,
      dimensionsMm: { width: W.toNumber(), height: H.toNumber(), depth: D.toNumber() },
      sheetSpec: { widthMm: SHEET_WIDTH_MM.toString(), heightMm: SHEET_HEIGHT_MM.toString(), areaMm2: SHEET_AREA_MM2.toString() },
      components, totalAreaMm2: totalFinishArea.toDecimalPlaces(2).toString(),
      costsLkr: { dickyBeading: dickyBeadingCost.toDecimalPlaces(2).toString(), collar: components.find(x => x.name === 'collarMm2')?.sheetPriceLkr ?? '0.00', sheetBeforeWastage: rawSheetCost.toDecimalPlaces(2).toString(), wastagePct: wastagePct.toString(), sheetWithWastage: sheetCost.toDecimalPlaces(2).toString(), powder: powderCost.toDecimalPlaces(2).toString(), primer: primerCost.toDecimalPlaces(2).toString(), flatBeading: beadingCost.toDecimalPlaces(2).toString(), hardware: hardwareCost.toDecimalPlaces(2).toString(), labour: labourCost.toDecimalPlaces(2).toString(), transport: transportCost.toDecimalPlaces(2).toString(), other: otherCost.toDecimalPlaces(2).toString(), totalCost: totalCost.toDecimalPlaces(2).toString(), marginPct: input.marginPct, sellingPriceRoundedUpTo10: sellingPrice.toDecimalPlaces(2).toString() },
      finishConversion: { squareFootMm2: SQ_FT_MM2.toString() },
    };
  }
  private coverOffset(height: Decimal): Decimal {
    if (height.lt(600)) return d(-20);
    if (height.eq(600)) return d(0);
    if (height.lte(700)) return d(20);
    if (height.lte(900)) return d(40);
    if (height.lte(1200)) return d(60);
    return d(80);
  }
  private canopyArea(width: Decimal, height: Decimal, depth: Decimal): Decimal {
    // Workbook has a probable typo (<=100 after <=600). Explicitly correct to <=1000 only after business confirmation.
    const extension = height.lte(600) ? 270 : height.lte(1000) ? 320 : 420;
    const depthExtension = height.lte(600) ? 230 : height.lte(1000) ? 250 : 350;
    return width.plus(extension).times(depth.plus(depthExtension));
  }
  private validateDimensions(input: CalculateCostDto) {
    for (const [name, value] of Object.entries({ width: input.widthMm, height: input.heightMm, depth: input.depthMm })) {
      if (!Number.isFinite(value) || value <= 0 || value > 10000) throw new BadRequestException(`${name}Mm must be between 1 and 10000`);
    }
    if (input.marginPct < 0 || input.marginPct > 0.95) throw new BadRequestException('marginPct must be between 0 and 0.95');
  }
}
