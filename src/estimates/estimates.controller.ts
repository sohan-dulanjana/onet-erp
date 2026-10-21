import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateEstimateDto } from './dto/create-estimate.dto';
@Controller('v1/estimates')
export class EstimatesController {
  constructor(private readonly prisma: PrismaService) {}
  @Post()
  async create(@Body() dto: CreateEstimateDto) {
    // In production, createdById must come from authenticated identity, never trust request body.
    return this.prisma.estimate.create({
      data: {
        estimateNo: dto.estimateNo,
        createdById: dto.createdById,
        status: 'CALCULATED',
        revisions: { create: {
          revision: 1,
          templateRevisionId: dto.templateRevisionId,
          inputSnapshot: dto.inputSnapshot as any,
          priceSnapshot: dto.priceSnapshot as any,
          componentBreakdown: dto.componentBreakdown as any,
          costTotal: dto.costTotal,
          sellingPrice: dto.sellingPrice,
          calculationVersion: 'preview-0.1'
        } }
      },
      include: { revisions: true }
    });
  }
  @Get(':id')
  async getOne(@Param('id') id: string) {
    return this.prisma.estimate.findUnique({ where: { id }, include: { revisions: { orderBy: { revision: 'desc' } } } });
  }
}
