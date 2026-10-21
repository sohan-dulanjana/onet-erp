import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { CostingRecordsService } from './costing-records.service';
@Controller('v1/costing-records')
export class CostingRecordsController {
  constructor(private readonly service: CostingRecordsService) {}
  @Get() list(@Query('search') search?: string) { return this.service.list(search); }
  @Post() create(@Body() dto: any) { return this.service.create(dto); }
  @Get(':id') get(@Param('id') id: string) { return this.service.get(id); }
  @Post(':id/revisions') revise(@Param('id') id: string, @Body() dto: any) { return this.service.revise(id, dto); }
}
