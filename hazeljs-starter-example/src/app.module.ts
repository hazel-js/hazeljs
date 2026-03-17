import { HazelModule } from '@hazeljs/core';
import { HelloController } from './hello.controller';

@HazelModule({
  controllers: [HelloController],
})
export class AppModule {}
