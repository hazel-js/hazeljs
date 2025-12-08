import { HazelModule } from '@hazeljs/core';
import { JobController } from './job.controller';
import { JobService } from './job.service';
import { AIService } from '@hazeljs/ai';

@HazelModule({
  controllers: [JobController],
  providers: [JobService, AIService],
  exports: [JobService],
})
export class AIModule {}
