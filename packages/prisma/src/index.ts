/**
 * @hazeljs/prisma - Prisma integration for HazelJS
 */

export { PrismaModule } from './prisma.module';
export { PrismaService } from './prisma.service';
export {
  BaseRepository,
  type PrismaModel,
  type WhereUniqueInput,
  type UpdateInput,
} from './base.repository';
export { Repository } from './repository.decorator';

