import { HazelModule } from '@hazeljs/core';
import { DemoController, DemoV1Controller, DemoV2Controller } from './demo.controller';
import { DemoService } from './demo.service';

@HazelModule({
  controllers: [DemoController, DemoV1Controller, DemoV2Controller],
  providers: [DemoService],
  exports: [DemoService],
})
export class DemoModule {}
