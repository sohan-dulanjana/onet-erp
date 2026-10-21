import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
async function bootstrap() {
 const app=await NestFactory.create(AppModule);app.setGlobalPrefix('api');
 app.useGlobalPipes(new ValidationPipe({whitelist:true,transform:true,forbidNonWhitelisted:true}));
 const config=new DocumentBuilder().setTitle('ONET Phase 1 API').setDescription('Master data, enclosure costing, estimates and quotations').setVersion('1.1.0').build();
 SwaggerModule.setup('api/docs',app,SwaggerModule.createDocument(app,config));
 const origins=(process.env.FRONTEND_ORIGIN??'http://localhost:5173,http://127.0.0.1:5173').split(',').map(x=>x.trim());
 app.enableCors({origin:origins,methods:['GET','POST','PATCH','PUT','DELETE','OPTIONS'],allowedHeaders:['Content-Type','Authorization'],exposedHeaders:['Content-Disposition']});
 await app.listen(process.env.PORT?Number(process.env.PORT):3000);
}
bootstrap();
