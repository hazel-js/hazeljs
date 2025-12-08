import { HazelModule } from '@hazeljs/core';
import { ServerlessController } from './serverless.controller';
import { ServerlessService } from './serverless.service';

@HazelModule({
  controllers: [ServerlessController],
  providers: [ServerlessService],
  exports: [ServerlessService],
})
export class ServerlessModule {}
