import { Module } from '@nestjs/common';
import { PdfModule } from '../pdf/pdf.module';
import { InvoicesController } from './invoices.controller';
import { InvoicesService } from './invoices.service';
@Module({ imports: [PdfModule], controllers: [InvoicesController], providers: [InvoicesService] })
export class InvoicesModule {}
