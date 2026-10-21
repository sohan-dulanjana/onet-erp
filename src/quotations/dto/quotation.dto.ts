import {IsArray,IsEmail,IsInt,IsNumber,IsOptional,IsString,Min,ValidateNested,ArrayNotEmpty} from 'class-validator';import {Type} from 'class-transformer';
export class QuotationLineDto{@IsString()description!:string;@IsInt()@Min(1)quantity!:number;@IsNumber()@Min(0)unitPrice!:number}
export class CreateQuotationDto{@IsOptional()@IsString()customerId?:string;@IsOptional()@IsString()estimateId?:string;@IsOptional()@IsArray()@IsString({each:true})estimateIds?:string[];@IsOptional()@IsString()terms?:string;@IsOptional()@IsArray()@ValidateNested({each:true})@Type(()=>QuotationLineDto)lines?:QuotationLineDto[]}
export class ReviseQuotationDto{@IsOptional()@IsString()terms?:string;@IsArray()@ValidateNested({each:true})@Type(()=>QuotationLineDto)lines!:QuotationLineDto[]}
export class CreateCustomerFromQuotationDto{@IsString()code!:string;@IsString()name!:string;@IsOptional()@IsEmail()email?:string}
