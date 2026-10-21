import { IsEnum, IsNotEmpty, IsOptional, IsString, IsBoolean, IsNumber, Min } from 'class-validator';
import { MaterialType } from '@prisma/client';
export class CreateMaterialDto { @IsString() @IsNotEmpty() code!: string; @IsString() @IsNotEmpty() name!: string; @IsEnum(MaterialType) type!: MaterialType; @IsOptional() @IsBoolean() isActive?: boolean; }
export class UpdateMaterialDto { @IsOptional() @IsString() @IsNotEmpty() name?: string; @IsOptional() @IsBoolean() isActive?: boolean; @IsOptional() @IsEnum(MaterialType) type?: MaterialType; }
export class AddThicknessDto { @IsNumber() @Min(0.01) thicknessMm!: number; }
