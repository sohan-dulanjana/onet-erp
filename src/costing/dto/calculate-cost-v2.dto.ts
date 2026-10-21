import { IsArray, IsBoolean, IsDateString, IsIn, IsInt, IsNumber, IsOptional, IsString, Max, Min, ValidateNested } from 'class-validator'; import { Type } from 'class-transformer';
export class HardwareQuantityDto { @IsString() hardwareItemId!:string; @IsInt() @Min(1) qty!:number; }
export class CalculateCostV2Dto {
 @IsString() templateCode!:string; @IsOptional() @IsIn(['FLAT_BEADING','DICKY_BEADING','SUNK_TYPE']) costingVariant?: 'FLAT_BEADING'|'DICKY_BEADING'|'SUNK_TYPE'; @IsIn(['INDOOR','OUTDOOR']) surfaceType!: 'INDOOR'|'OUTDOOR'; @IsNumber() @Min(1) @Max(10000) widthMm!:number; @IsNumber() @Min(1) @Max(10000) heightMm!:number; @IsNumber() @Min(1) @Max(10000) depthMm!:number;
 @IsString() materialId!:string; @IsNumber() @Min(0.01) thicknessMm!:number; @IsOptional() @IsString() sheetSpecId?:string;
 @IsOptional() @IsString() doorMaterialId?:string; @IsOptional() @IsNumber() @Min(0.01) doorThicknessMm?:number;
 @IsOptional() @IsString() mountingPlateMaterialId?:string; @IsOptional() @IsNumber() @Min(0.01) mountingPlateThicknessMm?:number;
 @IsOptional() @IsString() glandPlateMaterialId?:string; @IsOptional() @IsNumber() @Min(0.01) glandPlateThicknessMm?:number;
 @IsOptional() @IsString() ribMaterialId?:string; @IsOptional() @IsNumber() @Min(0.01) ribThicknessMm?:number;
 @IsOptional() @IsString() coverPlateMaterialId?:string; @IsOptional() @IsNumber() @Min(0.01) coverPlateThicknessMm?:number;
 @IsOptional() @IsString() collarMaterialId?:string; @IsOptional() @IsNumber() @Min(0.01) collarThicknessMm?:number; @IsOptional() @IsNumber() @Min(0) collarAreaMm2?:number; @IsOptional() @IsNumber() @Min(0) glandPlateAreaMm2?:number; @IsOptional() @IsNumber() @Min(0) benchAreaMm2?:number; @IsOptional() @IsNumber() @Min(0) dickyBeadingCostLkr?:number;
 @IsOptional() @IsString() sheetSpecOverrideId?:string;
 @IsArray() @IsString({each:true}) finishCodes!:string[]; @IsOptional() @IsArray() @ValidateNested({each:true}) @Type(()=>HardwareQuantityDto) hardwareItems?:HardwareQuantityDto[];
 @IsOptional() @IsString() costPolicyId?:string; @IsOptional() @IsDateString() priceDate?:string; @IsOptional() @IsNumber() @Min(0) @Max(0.95) marginPct?:number;
 @IsOptional() @IsNumber() @Min(0) flatBeadingRatePerM?:number; @IsOptional() @IsNumber() @Min(0) flatBeadingLengthMm?:number;
 @IsOptional() @IsNumber() @Min(0) labourCost?:number; @IsOptional() @IsNumber() @Min(0) transportCost?:number; @IsOptional() @IsNumber() @Min(0) otherCost?:number;
 @IsOptional() @IsNumber() ribWidthMm?:number; @IsOptional() @IsNumber() glandPlateWidthMm?:number;
 @IsOptional() @IsBoolean() includeCoverPlate?:boolean; @IsOptional() @IsBoolean() includeMountingPlate?:boolean; @IsOptional() @IsBoolean() includeDoor?:boolean; @IsOptional() @IsBoolean() includeRib?:boolean; @IsOptional() @IsBoolean() includeGlandPlate?:boolean; @IsOptional() @IsBoolean() includeZBracket?:boolean; @IsOptional() @IsBoolean() includeEarthBracket?:boolean; @IsOptional() @IsBoolean() includeBench?:boolean; @IsOptional() @IsBoolean() includeInnerDoor?:boolean; @IsOptional() @IsBoolean() includeCanopy?:boolean; @IsOptional() @IsBoolean() includeMountingBase?:boolean; @IsOptional() @IsBoolean() includeMountingEars?:boolean;
}
