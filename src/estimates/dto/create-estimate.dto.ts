import { IsObject, IsOptional, IsString } from 'class-validator';
export class CreateEstimateDto {
  @IsString() estimateNo!: string;
  @IsString() createdById!: string;
  @IsObject() inputSnapshot!: Record<string, unknown>;
  @IsObject() priceSnapshot!: Record<string, unknown>;
  @IsObject() componentBreakdown!: Record<string, unknown>;
  @IsString() costTotal!: string;
  @IsString() sellingPrice!: string;
  @IsOptional() @IsString() templateRevisionId?: string;
}
