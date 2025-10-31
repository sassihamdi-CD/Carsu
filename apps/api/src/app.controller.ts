/**
 * Purpose: Default Nest scaffold endpoint used as a simple sanity check.
 * Usage: Exposes GET / to confirm the app boots, DI works, and routing is wired.
 * Why: Helpful during early development to verify the stack end-to-end.
 * Notes: In a production-style API we do not expose "Hello World". We either
 *  - replace this with a minimal root status (service name, version, links to /docs and /health), or
 *  - remove the controller entirely and rely on /health and /docs.
 */
import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }
}
