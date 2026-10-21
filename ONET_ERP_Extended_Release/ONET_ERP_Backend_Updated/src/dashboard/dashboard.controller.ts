import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma.service';

@ApiTags('dashboard')
@Controller('v1/dashboard')
export class DashboardController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('summary')
  async summary() {
    const p = this.prisma as any;
    const [materials, hardwareItems, customers, quotations, recentQuotations] = await Promise.all([
      p.material.count(),
      p.hardwareItem.count(),
      p.customer.count(),
      p.quotation.count(),
      p.quotation.findMany({
        orderBy: { createdAt: 'desc' },
        take: 6,
        select: {
          id: true,
          quotationNo: true,
          status: true,
          currency: true,
          createdAt: true,
          customer: { select: { name: true } },
        },
      }),
    ]);
    return { counts: { materials, hardwareItems, customers, quotations }, recentQuotations };
  }
}
