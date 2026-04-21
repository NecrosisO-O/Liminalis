import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SourceItemsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSourceItemForOwner(userId: string, sourceItemId: string) {
    const sourceItem = await this.prisma.sourceItem.findFirst({
      where: {
        id: sourceItemId,
        ownerUserId: userId,
      },
      include: {
        groupManifest: true,
        packageFamilies: true,
        accessGrantSets: {
          where: { status: 'CURRENT' },
          include: {
            ordinaryPackageFamily: true,
            recoveryPackageFamily: true,
          },
        },
      },
    });

    if (!sourceItem) {
      throw new NotFoundException('Source item not found');
    }

    return sourceItem;
  }
}
