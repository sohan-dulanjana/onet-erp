import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

/** A deliberately small arithmetic expression evaluator. It does not execute JS or access the filesystem/network. */
export function evaluateFormulaExpression(expression: string, vars: Record<string, number>): number {
  if (typeof expression !== 'string' || !expression.trim()) throw new BadRequestException('Formula expression is required');
  const tokens = expression.match(/[A-Za-z_][A-Za-z0-9_]*|(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?|[()+\-*/^,]/g) ?? [];
  const compact = expression.replace(/\s/g, '');
  if (tokens.join('') !== compact) throw new BadRequestException(`Unsupported token in formula: ${expression}`);
  let index = 0;
  const peek = () => tokens[index];
  const take = () => tokens[index++];
  const expect = (v: string) => { if (take() !== v) throw new BadRequestException(`Expected '${v}' in formula`); };
  const primary = (): number => {
    const token = take();
    if (token === undefined) throw new BadRequestException('Unexpected end of formula');
    if (token === '+') return primary();
    if (token === '-') return -primary();
    if (token === '(') { const n = addSub(); expect(')'); return n; }
    if (/^(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/.test(token)) return Number(token);
    if (/^[A-Za-z_]/.test(token)) {
      if (peek() === '(') {
        take(); const args: number[] = [];
        if (peek() !== ')') { args.push(addSub()); while (peek() === ',') { take(); args.push(addSub()); } }
        expect(')');
        const fn: Record<string, (...values: number[]) => number> = {
          min: Math.min, max: Math.max, abs: Math.abs, ceil: Math.ceil, floor: Math.floor,
          round: (n, digits = 0) => { const p = 10 ** digits; return Math.round(n * p) / p; },
        };
        const result = fn[token.toLowerCase()];
        if (!result) throw new BadRequestException(`Function '${token}' is not allowed`);
        return result(...args);
      }
      if (!(token in vars) || !Number.isFinite(vars[token])) throw new BadRequestException(`Unknown formula variable '${token}'`);
      return vars[token];
    }
    throw new BadRequestException(`Unexpected token '${token}' in formula`);
  };
  const power = (): number => { let n = primary(); if (peek() === '^') { take(); n = n ** power(); } return n; };
  const mulDiv = (): number => { let n = power(); while (peek() === '*' || peek() === '/') { const op = take(); const rhs = power(); if (op === '/' && rhs === 0) throw new BadRequestException('Division by zero in formula'); n = op === '*' ? n * rhs : n / rhs; } return n; };
  const addSub = (): number => { let n = mulDiv(); while (peek() === '+' || peek() === '-') { const op = take(); const rhs = mulDiv(); n = op === '+' ? n + rhs : n - rhs; } return n; };
  const result = addSub();
  if (index !== tokens.length || !Number.isFinite(result)) throw new BadRequestException('Formula did not produce a finite number');
  return result;
}

@Injectable()
export class FormulaFormatsService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    return this.prisma.productTemplate.findMany({
      include: { family: true, revisions: { orderBy: { revision: 'desc' } } },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async get(id: string) {
    const item = await this.prisma.productTemplate.findUnique({ where: { id }, include: { family: true, revisions: { orderBy: { revision: 'desc' } } } });
    if (!item) throw new NotFoundException('Costing format not found');
    return item;
  }

  async create(dto: any) {
    if (!dto.code?.trim() || !dto.name?.trim() || !dto.familyCode?.trim()) throw new BadRequestException('code, name and familyCode are required');
    if (!dto.inputSchema || !Array.isArray(dto.inputSchema.fields) || !dto.formulaConfig || !Array.isArray(dto.formulaConfig.components)) {
      throw new BadRequestException('inputSchema.fields and formulaConfig.components arrays are required');
    }
    const family = await this.prisma.productFamily.upsert({ where: { code: dto.familyCode.trim() }, update: { name: dto.familyName?.trim() || dto.familyCode.trim() }, create: { code: dto.familyCode.trim(), name: dto.familyName?.trim() || dto.familyCode.trim() } });
    return this.prisma.productTemplate.create({ data: {
      familyId: family.id, code: dto.code.trim().toUpperCase(), name: dto.name.trim(), surfaceType: dto.surfaceType || 'CUSTOM', status: 'DRAFT',
      revisions: { create: { revision: 1, status: 'DRAFT', inputSchema: dto.inputSchema, formulaConfig: dto.formulaConfig } },
    }, include: { family: true, revisions: true } });
  }

  async addRevision(id: string, dto: any) {
    const template = await this.get(id);
    if (!dto.inputSchema || !Array.isArray(dto.inputSchema.fields) || !dto.formulaConfig || !Array.isArray(dto.formulaConfig.components)) throw new BadRequestException('inputSchema.fields and formulaConfig.components arrays are required');
    const revision = Math.max(0, ...template.revisions.map((r: any) => r.revision)) + 1;
    return this.prisma.templateRevision.create({ data: { templateId: id, revision, status: 'DRAFT', inputSchema: dto.inputSchema, formulaConfig: dto.formulaConfig } });
  }

  async publish(id: string, revisionId: string) {
    const revision = await this.prisma.templateRevision.findUnique({ where: { id: revisionId } });
    if (!revision || revision.templateId !== id) throw new NotFoundException('Formula revision not found for this format');
    const cfg: any = revision.formulaConfig;
    const schema: any = revision.inputSchema;
    if (!Array.isArray(schema?.fields) || !schema.fields.length) throw new BadRequestException('Add at least one input field before publishing');
    if (!Array.isArray(cfg?.components) || !cfg.components.length) throw new BadRequestException('Add at least one component before publishing');
    for (const c of cfg.components) {
      if (!c.code || !c.name || (!c.costFormula && !(c.quantityFormula && c.unitCostFormula) && !c.formulaBands?.length)) throw new BadRequestException(`Component '${c.name || c.code || '(unnamed)'}' needs costFormula, quantityFormula + unitCostFormula, or formulaBands`);
      if (Array.isArray(c.formulaBands)) for (const band of c.formulaBands) {
        if (band.default !== true && !band.when) throw new BadRequestException(`Formula band for '${c.name}' needs a when condition or default: true`);
        if (!band.costFormula && !(band.quantityFormula && band.unitCostFormula)) throw new BadRequestException(`Formula band for '${c.name}' needs costFormula or quantityFormula + unitCostFormula`);
      }
    }
    await this.prisma.$transaction(async tx => {
      await tx.templateRevision.updateMany({ where: { templateId: id, status: 'PUBLISHED' }, data: { status: 'RETIRED' } });
      await tx.templateRevision.update({ where: { id: revisionId }, data: { status: 'PUBLISHED', publishedAt: new Date() } });
      await tx.productTemplate.update({ where: { id }, data: { status: 'PUBLISHED' } });
    });
    return this.get(id);
  }

  async calculate(revisionId: string, input: Record<string, unknown>) {
    const revision = await this.prisma.templateRevision.findUnique({ where: { id: revisionId }, include: { template: true } });
    if (!revision) throw new NotFoundException('Formula revision not found');
    if (revision.status !== 'PUBLISHED') throw new BadRequestException('Only a published formula revision can calculate production costing');
    const schema: any = revision.inputSchema; const cfg: any = revision.formulaConfig;
    const vars: Record<string, number> = {};
    for (const field of schema.fields) {
      const value = input[field.key];
      if (field.required !== false && (value === undefined || value === null || value === '')) throw new BadRequestException(`Missing required input '${field.label || field.key}'`);
      if (value !== undefined && value !== null && value !== '') {
        if (field.type === 'text' || field.type === 'select' || field.type === 'date') {
          if (typeof value !== 'string') throw new BadRequestException(`Input '${field.key}' must be text`);
        } else {
          const n = Number(value);
          if (!Number.isFinite(n)) throw new BadRequestException(`Input '${field.key}' must be numeric for formula evaluation`);
          if (field.min !== undefined && n < field.min) throw new BadRequestException(`Input '${field.key}' must be at least ${field.min}`);
          vars[field.key] = n;
        }
      }
    }
    for (const [key, value] of Object.entries(input)) if (!(key in vars) && typeof value === 'number' && Number.isFinite(value)) vars[key] = value;
    const priceDate = input.priceDate ? new Date(String(input.priceDate)) : new Date();
    if (Number.isNaN(priceDate.getTime())) throw new BadRequestException('priceDate must be a valid date');
    const priceBindings = Array.isArray(cfg.priceBindings) ? cfg.priceBindings : [];
    const resolvedPrices = await Promise.all(priceBindings.map(async (binding: any) => {
      const value = await this.resolvePriceBinding(binding, input, priceDate);
      vars[binding.key] = value.numericValue;
      return { key: binding.key, source: binding.source, code: value.code, value: value.numericValue, details: value.details };
    }));
    const components = cfg.components.filter((c: any) => c.enabled !== false).map((c: any) => {
      const bands = Array.isArray(c.formulaBands) ? c.formulaBands : [];
      const band = bands.find((b: any) => b.default !== true && this.matchesBand(b.when, input)) ?? bands.find((b: any) => b.default === true) ?? null;
      if (Array.isArray(c.formulaBands) && c.formulaBands.length && !band && !c.costFormula && !(c.quantityFormula && c.unitCostFormula)) throw new BadRequestException(`No formula band matched component '${c.name}'`);
      const rule = band || c;
      const quantity = rule.quantityFormula ? evaluateFormulaExpression(rule.quantityFormula, vars) : 1;
      const unitCost = rule.unitCostFormula ? evaluateFormulaExpression(rule.unitCostFormula, vars) : 0;
      const cost = rule.costFormula ? evaluateFormulaExpression(rule.costFormula, vars) : quantity * unitCost;
      if (quantity < 0 || unitCost < 0 || cost < 0) throw new BadRequestException(`Component '${c.name}' produced a negative value`);
      return { code: c.code, name: c.name, matchedBand: band?.name ?? null, quantity: Number(quantity.toFixed(4)), unitCost: Number(unitCost.toFixed(4)), totalCost: Number(cost.toFixed(4)), unit: c.unit || 'each' };
    });
    const totalCost = components.reduce((sum: number, c: any) => sum + c.totalCost, 0);
    const marginPct = Number(input.marginPct ?? cfg.defaultMarginPct ?? 0.2);
    const rounding = Number(input.roundingIncrement ?? cfg.roundingIncrement ?? 10);
    if (marginPct < 0 || marginPct >= 1 || rounding <= 0) throw new BadRequestException('marginPct must be from 0 to less than 1 and roundingIncrement must be positive');
    const sellingPrice = Math.ceil((totalCost / (1 - marginPct)) / rounding) * rounding;
    return { templateId: revision.templateId, templateCode: revision.template.code, templateName: revision.template.name, templateRevisionId: revision.id, formulaRevision: revision.revision, inputs: input, priceSnapshot: resolvedPrices, components, totalCost: Number(totalCost.toFixed(4)), marginPct, roundingIncrement: rounding, sellingPrice: Number(sellingPrice.toFixed(2)), currency: cfg.currency || 'LKR', calculatedAt: new Date().toISOString() };
  }


  private matchesBand(conditions: any, input: Record<string, unknown>): boolean {
    if (!conditions || typeof conditions !== 'object') return false;
    const entries = Array.isArray(conditions) ? conditions : [conditions];
    return entries.every((condition: any) => {
      const actual = Number(input[condition.field]); const target = Number(condition.value);
      if (!condition.field || !Number.isFinite(actual) || !Number.isFinite(target)) return false;
      switch (condition.op) {
        case '<': return actual < target;
        case '<=': return actual <= target;
        case '>': return actual > target;
        case '>=': return actual >= target;
        case '==': return actual === target;
        case '!=': return actual !== target;
        default: throw new BadRequestException(`Unsupported formula band operator '${condition.op}'`);
      }
    });
  }


  private async resolvePriceBinding(binding: any, input: Record<string, unknown>, date: Date): Promise<{ numericValue: number; code: string; details: any }> {
    if (!binding?.key || !binding?.source) throw new BadRequestException('Each price binding requires key and source');
    const p: any = this.prisma as any;
    const activeWindow = { validFrom: { lte: date }, OR: [{ validTo: null }, { validTo: { gt: date } }] };
    if (binding.source === 'MATERIAL_PRICE') {
      const materialCode = String((binding.materialCodeInputKey ? input[binding.materialCodeInputKey] : undefined) ?? binding.materialCode ?? binding.code ?? '');
      const thicknessValue = binding.thicknessInputKey ? input[binding.thicknessInputKey] : binding.thicknessMm;
      if (!materialCode || thicknessValue === undefined || thicknessValue === null || thicknessValue === '') throw new BadRequestException(`Material price binding '${binding.key}' requires material code and thickness`);
      const material = await p.material.findUnique({ where: { code: materialCode }, select: { id: true, code: true } });
      if (!material) throw new NotFoundException(`Material not found for price binding '${binding.key}': ${materialCode}`);
      const thicknessMm = Number(thicknessValue);
      const sheetSpecCode = binding.sheetSpecCode || (binding.valueAs === 'PRICE_PER_MM2' ? 'STD-1218-2436' : undefined);
      const sheetSpec = sheetSpecCode ? await p.sheetSpec.findUnique({ where: { code: sheetSpecCode }, select: { id: true, widthMm: true, heightMm: true, code: true } }) : null;
      if (sheetSpecCode && !sheetSpec) throw new NotFoundException(`Sheet specification not found: ${sheetSpecCode}`);
      const supplier = binding.supplierCode ? await p.supplier.findUnique({ where: { code: binding.supplierCode }, select: { id: true } }) : null;
      if (binding.supplierCode && !supplier) throw new NotFoundException(`Supplier not found: ${binding.supplierCode}`);
      const price = await p.materialPrice.findFirst({ where: { materialId: material.id, thicknessMm, sheetSpecId: sheetSpec ? sheetSpec.id : null, ...(supplier ? { supplierId: supplier.id } : { supplierId: null }), ...activeWindow }, orderBy: { validFrom: 'desc' } });
      if (!price) throw new NotFoundException(`No effective material price for ${materialCode}, ${thicknessMm} mm on ${date.toISOString().slice(0,10)}`);
      let numericValue = Number(price.unitPrice);
      const valueAs = binding.valueAs || 'UNIT_PRICE';
      if (valueAs === 'PRICE_PER_MM2') {
        if (price.unit === 'SHEET') {
          const spec = sheetSpec ?? (price.sheetSpecId ? await p.sheetSpec.findUnique({ where: { id: price.sheetSpecId }, select: { widthMm: true, heightMm: true } }) : null);
          if (!spec) throw new BadRequestException(`Sheet price binding '${binding.key}' needs a sheet specification to convert price per sheet to price per mm²`);
          numericValue /= Number(spec.widthMm) * Number(spec.heightMm);
        } else if (price.unit === 'SQUARE_FOOT') numericValue /= (304.8 * 304.8);
        else throw new BadRequestException(`Price binding '${binding.key}' cannot convert ${price.unit} to price per mm²`);
      }
      return { numericValue, code: materialCode, details: { priceId: price.id, materialCode, thicknessMm, unit: price.unit, unitPrice: String(price.unitPrice), valueAs, validFrom: price.validFrom, sheetSpecCode: sheetSpec?.code ?? null } };
    }
    if (binding.source === 'FINISH_RATE') {
      const code = String(binding.codeInputKey ? input[binding.codeInputKey] : binding.code ?? '');
      const row = await p.finishRate.findFirst({ where: { code, ...activeWindow }, orderBy: { validFrom: 'desc' } });
      if (!row) throw new NotFoundException(`No effective finish rate found for ${code}`);
      let numericValue = Number(row.ratePerSqFt) * Number(row.coats) * Number(row.sides);
      const valueAs = binding.valueAs || 'PRICE_PER_SQFT';
      if (valueAs === 'PRICE_PER_MM2') numericValue /= (304.8 * 304.8);
      return { numericValue, code, details: { rateId: row.id, code, ratePerSqFt: String(row.ratePerSqFt), coats: row.coats, sides: row.sides, valueAs, validFrom: row.validFrom } };
    }
    if (binding.source === 'HARDWARE_PRICE') {
      const code = String(binding.codeInputKey ? input[binding.codeInputKey] : binding.code ?? '');
      const item = await p.hardwareItem.findUnique({ where: { code }, select: { id: true, code: true } });
      if (!item) throw new NotFoundException(`Hardware item not found: ${code}`);
      const row = await p.hardwarePrice.findFirst({ where: { hardwareItemId: item.id, ...activeWindow }, orderBy: { validFrom: 'desc' } });
      if (!row) throw new NotFoundException(`No effective hardware price found for ${code}`);
      return { numericValue: Number(row.unitPrice), code, details: { priceId: row.id, hardwareCode: code, unitPrice: String(row.unitPrice), validFrom: row.validFrom } };
    }
    throw new BadRequestException(`Unsupported price binding source '${binding.source}'. Use MATERIAL_PRICE, FINISH_RATE or HARDWARE_PRICE.`);
  }

}
