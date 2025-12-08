import { Get, Controller } from '@hazeljs/core';

@Controller('/hello')
export class HelloController {
  @Get()
  hello(): Promise<string> {
    return Promise.resolve('Hello, World!');
  }
}
