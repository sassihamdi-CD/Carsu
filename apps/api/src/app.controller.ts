/**
 * Purpose: Minimal root controller for sanity checks and starter routing.
 * Usage: Exposes GET / returning a static greeting via AppService.
 * Why: Scaffold only; will be replaced/augmented by real feature modules.
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
