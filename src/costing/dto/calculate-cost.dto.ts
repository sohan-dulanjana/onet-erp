import { IsBoolean, IsIn, IsInt, IsNumber, IsObject, IsOptional, IsString, Max, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class CostRatesDto {
  @IsNumber() @Min(0) baseCapSheetPrice!: number;
  @IsNumber() @Min(0) doorSheetPrice!: number;
  @IsNumber() @Min(0) mountingPlateSheetPrice!: number;
  @IsNumber() @Min(0) coverPlateSheetPrice!: number;
  @IsNumber() @Min(0) ribSheetPrice!: number;
  @IsNumber() @Min(0) glandPlateSheetPrice!: number;
  @IsOptional() @IsNumber() @Min(0) collarSheetPrice?: number;
  @IsOptional() @IsNumber() @Min(0) zBracketSheetPrice?: number;
  @IsOptional() @IsNumber() @Min(0) earthBracketSheetPrice?: number;
  @IsOptional() @IsNumber() @Min(0) benchSheetPrice?: number;
  @IsOptional() @IsNumber() @Min(0) innerDoorSheetPrice?: number;
  @IsOptional() @IsNumber() @Min(0) canopySheetPrice?: number;
  @IsOptional() @IsNumber() @Min(0) mountingBaseSheetPrice?: number;
  @IsOptional() @IsNumber() @Min(0) mountingEarSheetPrice?: number;
  @IsNumber() @Min(0) powderRatePerSqFt!: number;
  @IsOptional() @IsNumber() @Min(0) primerRatePerSqFt?: number;
  @IsOptional() @IsNumber() @Min(0) hardwareTotal?: number;
  @IsOptional() @IsNumber() @Min(0) labourCost?: number;
  @IsOptional() @IsNumber() @Min(0) transportCost?: number;
  @IsOptional() @IsNumber() @Min(0) otherCost?: number;
}

export class CalculateCostDto {
  @IsString() templateCode!: string;
  @IsOptional() @IsIn(['FLAT_BEADING', 'DICKY_BEADING', 'SUNK_TYPE']) costingVariant?: 'FLAT_BEADING' | 'DICKY_BEADING' | 'SUNK_TYPE';
  @IsOptional() @IsNumber() @Min(0) collarAreaMm2?: number;
  @IsOptional() @IsNumber() @Min(0) glandPlateAreaMm2?: number;
  @IsOptional() @IsNumber() @Min(0) benchAreaMm2?: number;
  @IsOptional() @IsNumber() @Min(0) dickyBeadingCostLkr?: number;
  @IsIn(['INDOOR', 'OUTDOOR']) surfaceType!: 'INDOOR' | 'OUTDOOR';
  @IsNumber() @Min(1) @Max(10000) widthMm!: number;
  @IsNumber() @Min(1) @Max(10000) heightMm!: number;
  @IsNumber() @Min(1) @Max(10000) depthMm!: number;
  @IsNumber() @Min(0) @Max(0.95) marginPct!: number;
  @IsOptional() @IsNumber() @Min(0) @Max(1) wastagePct?: number;
  @IsOptional() @IsNumber() @Min(0) ribWidthMm?: number;
  @IsOptional() @IsNumber() @Min(0) glandPlateWidthMm?: number;
  @IsOptional() @IsBoolean() includeCoverPlate?: boolean;
  @IsOptional() @IsBoolean() includeMountingPlate?: boolean;
  @IsOptional() @IsBoolean() includeDoor?: boolean;
  @IsOptional() @IsBoolean() includeRib?: boolean;
  @IsOptional() @IsBoolean() includeGlandPlate?: boolean;
  @IsOptional() @IsBoolean() includeZBracket?: boolean;
  @IsOptional() @IsBoolean() includeEarthBracket?: boolean;
  @IsOptional() @IsBoolean() includeBench?: boolean;
  @IsOptional() @IsBoolean() includeInnerDoor?: boolean;
  @IsOptional() @IsBoolean() includeCanopy?: boolean;
  @IsOptional() @IsBoolean() includeMountingBase?: boolean;
  @IsOptional() @IsBoolean() includeMountingEars?: boolean;
  @IsOptional() @IsBoolean() includePrimer?: boolean;
  @IsOptional() @IsNumber() @Min(0) flatBeadingRatePerM?: number;
  @IsOptional() @IsNumber() @Min(0) flatBeadingLengthMm?: number;
  @IsOptional() @ValidateNested() @Type(() => CostRatesDto) rates?: CostRatesDto;
}
