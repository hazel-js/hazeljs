import { HazelModule } from '@hazeljs/core';
import { SwaggerService } from './swagger.service';
import { SwaggerController } from './swagger.controller';
import { Type } from '@hazeljs/core';
import logger from '@hazeljs/core';
import type { SwaggerModuleOptions } from './swagger.types';
import {
  mergeSwaggerModuleOptions,
  replaceSwaggerModuleOptions,
  getSwaggerModuleOptions,
} from './swagger-config';

@HazelModule({
  providers: [SwaggerService],
  controllers: [SwaggerController],
  exports: [SwaggerService],
})
export class SwaggerModule {
  /**
   * Document + UI options.
   * @param replaceAll When true, replaces all options (use to reset). Default merges shallowly with previous `configure` calls.
   */
  static configure(options: SwaggerModuleOptions, replaceAll = false): void {
    if (replaceAll) {
      replaceSwaggerModuleOptions(options);
    } else {
      mergeSwaggerModuleOptions(options);
    }
  }

  static getOptions(): SwaggerModuleOptions {
    return getSwaggerModuleOptions();
  }

  static setRootModule(rootModule: Type<unknown>): void {
    logger.debug('SwaggerModule: Setting root module:', rootModule.name);
    SwaggerController.setRootModule(rootModule);
  }
}
