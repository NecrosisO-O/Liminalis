import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { appConfig } from './config/app.config';
import { IdentityModule } from './identity/identity.module';
import { PolicyModule } from './policy/policy.module';
import { PrismaModule } from './prisma/prisma.module';
import { SourceItemsModule } from './source-items/source-items.module';
import { TrustModule } from './trust/trust.module';
import { UploadsModule } from './uploads/uploads.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig],
    }),
    PrismaModule,
    IdentityModule,
    PolicyModule,
    TrustModule,
    UploadsModule,
    SourceItemsModule,
  ],
})
export class AppModule {}
