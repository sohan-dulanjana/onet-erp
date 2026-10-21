import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { PrismaModule } from './prisma.module';
import { CostingModule } from './costing/costing.module';
import { EstimatesModule } from './estimates/estimates.module';
import { MaterialsModule } from './materials/materials.module';
import { MaterialPricesModule } from './material-prices/material-prices.module';
import { HardwareModule } from './hardware/hardware.module';
import { FinishRatesModule } from './finish-rates/finish-rates.module';
import { CostPoliciesModule } from './cost-policies/cost-policies.module';
import { SuppliersModule } from './suppliers/suppliers.module';
import { LookupsModule } from './lookups/lookups.module';
import { CustomersModule } from './customers/customers.module';
import { QuotationsModule } from './quotations/quotations.module';
import { DashboardController } from './dashboard/dashboard.controller';
import { FormulaFormatsModule } from './formula-formats/formula-formats.module';
import { InventoryModule } from './inventory/inventory.module';
import { InvoicesModule } from './invoices/invoices.module';
import { CostingRecordsModule } from './costing-records/costing-records.module';
@Module({imports:[PrismaModule,CostingModule,EstimatesModule,MaterialsModule,MaterialPricesModule,HardwareModule,FinishRatesModule,CostPoliciesModule,SuppliersModule,LookupsModule,CustomersModule,QuotationsModule,FormulaFormatsModule,InventoryModule,InvoicesModule,CostingRecordsModule],controllers:[HealthController,DashboardController]})
export class AppModule {}
