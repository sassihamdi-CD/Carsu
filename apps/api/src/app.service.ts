/**
 * Purpose: Provide a minimal service for the root controller response.
 * Usage: Used by AppController.getHello() during initial scaffolding.
 * Why: Placeholder to validate Nest DI wiring; real services will replace this.
 */
import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    return 'Hello World!';
  }
}
