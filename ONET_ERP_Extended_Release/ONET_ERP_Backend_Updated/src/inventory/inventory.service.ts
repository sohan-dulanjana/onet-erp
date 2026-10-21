import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}
  private get p(): any { return this.prisma as any; }
  async list(search?: string, category?: string, lowStock = false) {
    const rows = await this.p.inventoryItem.findMany({ where: { isActive: true, ...(category ? { category } : {}), ...(search ? { OR: [{ code: { contains: search, mode: 'insensitive' } }, { name: { contains: search, mode: 'insensitive' } }] } : {}) }, orderBy: { name: 'asc' } });
    return lowStock ? rows.filter((row: any) => Number(row.quantityOnHand) <= Number(row.reorderLevel)) : rows;
  }
  async create(dto: any) {
    if (!dto.code?.trim() || !dto.name?.trim()) throw new BadRequestException('Item code and name are required');
    const opening = Number(dto.openingStock ?? 0);
    if (!Number.isFinite(opening) || opening < 0) throw new BadRequestException('Opening stock must be a non-negative number');
    return this.p.$transaction(async (tx: any) => {
      const item = await tx.inventoryItem.create({ data: { code: dto.code.trim().toUpperCase(), name: dto.name.trim(), category: dto.category || null, unit: dto.unit || 'each', reorderLevel: Number(dto.reorderLevel ?? 0), unitCost: Number(dto.unitCost ?? 0), location: dto.location || null, quantityOnHand: opening } });
      if (opening > 0) await tx.inventoryMovement.create({ data: { itemId: item.id, type: 'RECEIPT', quantity: opening, unitCost: Number(dto.unitCost ?? 0), reference: 'OPENING_STOCK', notes: 'Opening stock balance' } });
      return item;
    }, { isolationLevel: 'Serializable' });
  }
  async update(id: string, dto: any) {
    const item = await this.p.inventoryItem.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('Inventory item not found');
    const { code, name, category, unit, reorderLevel, unitCost, location, isActive } = dto;
    return this.p.inventoryItem.update({ where: { id }, data: { ...(code !== undefined ? { code: String(code).trim().toUpperCase() } : {}), ...(name !== undefined ? { name } : {}), ...(category !== undefined ? { category } : {}), ...(unit !== undefined ? { unit } : {}), ...(reorderLevel !== undefined ? { reorderLevel: Number(reorderLevel) } : {}), ...(unitCost !== undefined ? { unitCost: Number(unitCost) } : {}), ...(location !== undefined ? { location } : {}), ...(isActive !== undefined ? { isActive: Boolean(isActive) } : {}) } });
  }
  async movements(id: string) {
    if (!(await this.p.inventoryItem.findUnique({ where: { id }, select: { id: true } }))) throw new NotFoundException('Inventory item not found');
    return this.p.inventoryMovement.findMany({ where: { itemId: id }, orderBy: { createdAt: 'desc' } });
  }
  async move(id: string, dto: any) {
    const type = dto.type;
    const quantity = Number(dto.quantity);
    if (!['RECEIPT', 'ISSUE', 'ADJUSTMENT'].includes(type)) throw new BadRequestException('Movement type must be RECEIPT, ISSUE or ADJUSTMENT');
    if (!Number.isFinite(quantity) || quantity === 0 || (type !== 'ADJUSTMENT' && quantity < 0)) throw new BadRequestException('Quantity must be non-zero; receipt/issue quantities must be positive');
    return this.p.$transaction(async (tx: any) => {
      const item = await tx.inventoryItem.findUnique({ where: { id } });
      if (!item) throw new NotFoundException('Inventory item not found');
      const signed = type === 'RECEIPT' ? quantity : type === 'ISSUE' ? -quantity : quantity;
      const next = Number(item.quantityOnHand) + signed;
      if (next < 0) throw new BadRequestException(`Insufficient stock. Available: ${item.quantityOnHand}`);
      const updated = await tx.inventoryItem.update({ where: { id }, data: { quantityOnHand: next, ...(dto.unitCost !== undefined && type === 'RECEIPT' ? { unitCost: Number(dto.unitCost) } : {}) } });
      const movement = await tx.inventoryMovement.create({ data: { itemId: id, type, quantity: signed, unitCost: dto.unitCost === undefined ? null : Number(dto.unitCost), reference: dto.reference || null, notes: dto.notes || null } });
      return { item: updated, movement };
    }, { isolationLevel: 'Serializable' });
  }
}
