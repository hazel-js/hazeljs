import { HazelModule } from '@hazeljs/core';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { PrismaService } from '@hazeljs/prisma';
import { UserRepository } from './user.repository';
import { PrismaModule } from '@hazeljs/prisma';

@HazelModule({
  imports: [PrismaModule],
  controllers: [UserController],
  providers: [PrismaService, UserService, UserRepository],
  exports: [UserService],
})
export class UserModule {}
