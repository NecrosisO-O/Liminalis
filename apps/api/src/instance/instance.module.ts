import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { InstanceController } from './instance.controller';

@Module({
  imports: [PrismaModule],
  controllers: [InstanceController],
})
export class InstanceModule {}
