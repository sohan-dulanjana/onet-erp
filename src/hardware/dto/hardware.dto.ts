import { IsBoolean, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, IsDateString, Min } from 'class-validator'; import { PriceUnit } from '@prisma/client';
export class CreateHardwareItemDto { @IsString() @IsNotEmpty() code!:string; @IsString() @IsNotEmpty() name!:string; @IsOptional() @IsEnum(PriceUnit) unit?:PriceUnit; @IsOptional() @IsBoolean() isActive?:boolean; }
export class UpdateHardwareItemDto { @IsOptional() @IsString() @IsNotEmpty() name?:string; @IsOptional() @IsEnum(PriceUnit) unit?:PriceUnit; @IsOptional() @IsBoolean() isActive?:boolean; }
export class CreateHardwarePriceDto { @IsNumber() @Min(0) unitPrice!:number; @IsOptional() @IsString() currency?:string; @IsDateString() validFrom!:string; }
