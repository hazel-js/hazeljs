import { HazelApp } from '@hazeljs/core';
import { AppModule } from './app.module';
import { SwaggerModule } from '@hazeljs/swagger';
import logger from '@hazeljs/core';

async function bootstrap(): Promise<void> {
  logger.debug('Starting bootstrap...');
  const app = new HazelApp(AppModule);

  // Set the root module for SwaggerController
  logger.debug('Setting root module for Swagger...');
  SwaggerModule.setRootModule(AppModule);
  logger.debug('Root module set for Swagger');

  await app.listen(3000);
  logger.debug('Server started on port 3000');
}

bootstrap();
