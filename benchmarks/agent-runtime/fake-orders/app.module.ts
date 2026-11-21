import { HazelModule } from '@hazeljs/core';
import { OrdersService } from './orders.service';
import { OrdersController, OrdersTestController } from './orders.controller';

@HazelModule({
  controllers: [OrdersController, OrdersTestController],
  providers: [OrdersService],
})
export class FakeOrdersModule {}
