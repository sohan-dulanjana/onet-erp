import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { InventoryService } from './inventory.service';
@Controller('v1/inventory')
export class InventoryController {
  constructor(private readonly service: InventoryService) {}
  @Get() list(@Query('search') search?: string, @Query('category') category?: string, @Query('lowStock') lowStock?: string) { return this.service.list(search, category, lowStock === 'true'); }
  @Post() create(@Body() dto: any) { return this.service.create(dto); }
  @Patch(':id') update(@Param('id') id: string, @Body() dto: any) { return this.service.update(id, dto); }
  @Get(':id/movements') movements(@Param('id') id: string) { return this.service.movements(id); }
  @Post(':id/movements') move(@Param('id') id: string, @Body() dto: any) { return this.service.move(id, dto); }
}
