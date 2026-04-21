import { Module } from '@nestjs/common';
import { AdminModule } from './admin/admin.module';
import { ConfigModule } from '@nestjs/config';
import { appConfig } from './config/app.config';
import { IdentityModule } from './identity/identity.module';
import { PolicyModule } from './policy/policy.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProjectionsModule } from './projections/projections.module';
import { PublicLinksModule } from './public-links/public-links.module';
import { RetrievalModule } from './retrieval/retrieval.module';
import { ExtractionModule } from './extraction/extraction.module';
import { SharesModule } from './shares/shares.module';
import { SourceItemsModule } from './source-items/source-items.module';
import { TrustModule } from './trust/trust.module';
import { UploadsModule } from './uploads/uploads.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig],
    }),
    AdminModule,
    PrismaModule,
    IdentityModule,
    PolicyModule,
    ProjectionsModule,
    ExtractionModule,
    TrustModule,
    UploadsModule,
    PublicLinksModule,
    SharesModule,
    SourceItemsModule,
    RetrievalModule,
  ],
})
export class AppModule {}
