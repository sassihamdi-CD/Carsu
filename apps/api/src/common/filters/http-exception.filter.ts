/**
 * Purpose: Centralize HTTP error handling and response shape across the API.
 * Usage: Registered globally in main.ts via app.useGlobalFilters(new HttpExceptionFilter()).
 * Why: Ensures consistent, non-leaky errors for clients; simplifies controllers by removing boilerplate.
 * Notes: Extend to map domain errors to specific HTTP codes and attach correlation/user/tenant IDs.
 */
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();

    const isHttp = exception instanceof HttpException;
    const status = isHttp
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    const message = isHttp
      ? (exception.getResponse() as any)
      : 'Internal server error';

    const payload = {
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      statusCode: status,
      error:
        typeof message === 'string'
          ? message
          : message?.message || message?.error || 'Error',
      details: typeof message === 'object' ? message : undefined,
    };

    response.status(status).json(payload);
  }
}


