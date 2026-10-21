import { Body, Controller, Get, Param, Post, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { InvoicesService } from './invoices.service';
@Controller('v1/invoices')
export class InvoicesController {
  constructor(private readonly service: InvoicesService) {}
  @Get() list(@Query('status') status?: string, @Query('search') search?: string) { return this.service.list(status, search); }
  @Post('from-quotation/:quotationId') createFromQuotation(@Param('quotationId') quotationId: string, @Body() dto: any) { return this.service.createFromQuotation(quotationId, dto); }
  @Get(':id') get(@Param('id') id: string) { return this.service.get(id); }
  @Post(':id/revisions') revise(@Param('id') id: string, @Body() dto: any) { return this.service.revise(id, dto); }
  @Post(':id/issue') issue(@Param('id') id: string) { return this.service.issue(id); }
  @Post(':id/paid') paid(@Param('id') id: string) { return this.service.markPaid(id); }
  @Post(':id/void') void(@Param('id') id: string) { return this.service.void(id); }
  @Get(':id/pdf') async pdf(@Param('id') id: string, @Res() res: Response) { const b = await this.service.pdfBuffer(id); res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${id}.pdf"`, 'Content-Length': String(b.length) }); res.end(b); }
}
