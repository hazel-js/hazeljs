import { Controller, Get } from '@hazeljs/core';

@Controller('/')
export class HealthController {
  @Get('health')
  health() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  @Get()
  root() {
    return { message: 'HazelJS AI-Native Application', version: '1.0.0' };
  }
}
