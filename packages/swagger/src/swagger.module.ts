import { HazelModule } from '@hazeljs/core';
import { SwaggerService } from './swagger.service';
import { SwaggerController } from './swagger.controller';
import { Type } from '@hazeljs/core';
import logger from '@hazeljs/core';

@HazelModule({
  providers: [SwaggerService],
  controllers: [SwaggerController],
  exports: [SwaggerService],
})
export class SwaggerModule {
  static setRootModule(rootModule: Type<unknown>): void {
    logger.debug('SwaggerModule: Setting root module:', rootModule.name);
    SwaggerController.setRootModule(rootModule);
  }
}
