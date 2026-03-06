import { HazelModule } from '@hazeljs/core';
import { AIModule as PackageAIModule } from '@hazeljs/ai';
import { JobController } from './job.controller';
import { JobService } from './job.service';

@HazelModule({
  imports: [PackageAIModule],
  controllers: [JobController],
  providers: [JobService],
  exports: [JobService],
})
export class AIModule {}
