import { Body, Controller, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CalculateCostDto } from './dto/calculate-cost.dto';
import { CalculateCostV2Dto } from './dto/calculate-cost-v2.dto';
import { CostingService } from './costing.service';
@ApiTags('costing')
@Controller('v1/costing')
export class CostingController {
  constructor(private readonly costing: CostingService) {}
  @Post('calculate') calculate(@Body() dto: CalculateCostDto) { return this.costing.calculate(dto); }
  @Post('calculate-v2') calculateV2(@Body() dto: CalculateCostV2Dto) { return this.costing.calculateV2(dto); }
}
