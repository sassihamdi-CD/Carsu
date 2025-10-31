/**
 * Purpose: Provide basic structured request logging (method, path, duration).
 * Usage: Can be applied globally or per-controller via app/useInterceptors or @UseInterceptors.
 * Why: A lightweight starting point for observability; easy to evolve to pino/winston with correlation IDs.
 * Notes: Avoid logging PII; enrich with request IDs and user/tenant context later.
 * 
 * Logging Strategy:
 * - Uses NestJS Logger for consistency and production-ready log management
 * - Logs all HTTP requests with method, path, and duration for observability
 * - Structured JSON format for easy parsing by log aggregation tools
 */
import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const start = Date.now();
    return next.handle().pipe(
      tap(() => {
        const ms = Date.now() - start;
        // Structured logging: method, path, and duration for observability
        // Using logger.log for all requests (can be filtered via LOG_LEVEL in production)
        this.logger.log(
          JSON.stringify({
            level: 'info',
            msg: 'request',
            method: req.method,
            path: req.url,
            durationMs: ms,
          }),
        );
      }),
    );
  }
}


