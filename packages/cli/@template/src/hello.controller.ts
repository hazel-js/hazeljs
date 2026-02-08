import { Controller, Get } from '@hazeljs/core';

@Controller('/hello')
export class HelloController {
  @Get()
  hello() {
    return { message: 'Hello from HazelJS!' };
  }
}
