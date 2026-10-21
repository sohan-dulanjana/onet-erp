import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateMaterialDto, UpdateMaterialDto, AddThicknessDto } from './dto/material.dto';
import { CreateSheetSpecDto, UpdateSheetSpecDto } from './dto/sheet-spec.dto';
@Injectable()
export class MaterialsService {
  constructor(private prisma: PrismaService) {}
  list(type?: string, page=1, limit=50) { return this.prisma.material.findMany({ where: { ...(type ? { type: type as any } : {}) }, include: { materialThicknesses: { orderBy: { thicknessMm: 'asc' } } }, orderBy: { code: 'asc' }, skip:(page-1)*limit,take:limit }); }
  async get(id:string) { const x=await this.prisma.material.findUnique({where:{id},include:{materialThicknesses:{orderBy:{thicknessMm:'asc'}},prices:{where:{validFrom:{lte:new Date()},OR:[{validTo:null},{validTo:{gt:new Date()}}]},orderBy:{validFrom:'desc'},include:{sheetSpec:true,supplier:true}}}}); if(!x) throw new NotFoundException('Material not found'); return x; }
  async deactivate(id:string) { await this.get(id); return this.prisma.material.update({where:{id},data:{isActive:false}}); }
  listSheetSpecs(page=1,limit=50) { return this.prisma.sheetSpec.findMany({orderBy:{code:'asc'},skip:(page-1)*limit,take:limit}); }
  async getSheetSpec(id:string) { const x=await this.prisma.sheetSpec.findUnique({where:{id},include:{prices:{where:{validTo:null},include:{material:true}}}}); if(!x) throw new NotFoundException('Sheet specification not found'); return x; }
  createSheetSpec(d:CreateSheetSpecDto) { return this.prisma.sheetSpec.create({data:d}); }
  async updateSheetSpec(id:string,d:UpdateSheetSpecDto) { await this.getSheetSpec(id); return this.prisma.sheetSpec.update({where:{id},data:d}); }
  async deactivateSheetSpec(id:string) { await this.getSheetSpec(id); return this.prisma.sheetSpec.update({where:{id},data:{isActive:false}}); }
  create(dto:CreateMaterialDto) { return this.prisma.material.create({data:dto}); }
  async update(id:string,dto:UpdateMaterialDto) { await this.get(id); return this.prisma.material.update({where:{id},data:dto}); }
  async addThickness(id:string,dto:AddThicknessDto) { await this.get(id); return this.prisma.materialThickness.create({data:{materialId:id,thicknessMm:dto.thicknessMm}}); }
  async deleteThickness(id:string,thicknessId:string) { const t=await this.prisma.materialThickness.findFirst({where:{id:thicknessId,materialId:id}}); if(!t) throw new NotFoundException('Thickness not found for material'); return this.prisma.materialThickness.delete({where:{id:thicknessId}}); }
}
