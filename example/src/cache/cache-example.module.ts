import { HazelModule } from '@hazeljs/core';
import { CacheController } from './cache.controller';

@HazelModule({
  controllers: [CacheController],
})
export class CacheExampleModule {}
