import { Module } from '@nestjs/common';
import { FormulaFormatsController } from './formula-formats.controller';
import { FormulaFormatsService } from './formula-formats.service';
@Module({ controllers: [FormulaFormatsController], providers: [FormulaFormatsService] })
export class FormulaFormatsModule {}
