import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { PolicyModule } from '../policy/policy.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminOperationsController } from './admin-operations.controller';
import { AdminPolicyController } from './admin-policy.controller';

@Module({
  imports: [IdentityModule, PolicyModule, PrismaModule],
  controllers: [AdminPolicyController, AdminOperationsController],
})
export class AdminModule {}
