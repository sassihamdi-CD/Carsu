/**
 * Purpose: Inject the authenticated principal into controller handlers.
 * Usage: handler(@CurrentUser() user: { userId: string })
 * Why: Avoids manual casting of req.user in every route; clearer types.
 */
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface RequestUser {
  userId: string;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): RequestUser | undefined => {
    const request = ctx.switchToHttp().getRequest();
    return request.user as RequestUser | undefined;
  },
);
