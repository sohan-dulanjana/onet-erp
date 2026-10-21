import { Module } from '@nestjs/common';
import { CostingRecordsController } from './costing-records.controller';
import { CostingRecordsService } from './costing-records.service';
@Module({ controllers: [CostingRecordsController], providers: [CostingRecordsService] })
export class CostingRecordsModule {}
