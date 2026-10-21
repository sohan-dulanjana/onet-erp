import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { FormulaFormatsService } from './formula-formats.service';
@Controller('v1/formula-formats')
export class FormulaFormatsController {
  constructor(private readonly service: FormulaFormatsService) {}
  @Get() list() { return this.service.list(); }
  @Post() create(@Body() dto: any) { return this.service.create(dto); }
  @Get(':id') get(@Param('id') id: string) { return this.service.get(id); }
  @Post(':id/revisions') addRevision(@Param('id') id: string, @Body() dto: any) { return this.service.addRevision(id, dto); }
  @Post(':id/revisions/:revisionId/publish') publish(@Param('id') id: string, @Param('revisionId') revisionId: string) { return this.service.publish(id, revisionId); }
  @Post('calculate/:revisionId') calculate(@Param('revisionId') revisionId: string, @Body() input: Record<string, unknown>) { return this.service.calculate(revisionId, input); }
}
