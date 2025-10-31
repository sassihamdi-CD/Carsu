/**
 * Purpose: Protects routes by validating JWTs and attaching user info to request context.
 * Usage: Applied globally (or at controller/method level) to restrict access to authenticated users.
 * Why: Ensures only valid users act on API; essential for all tenant/resource isolation.
 * Notes: Leverages JWT strategy; can be extended for role checks or tenant enforcement.
 */
import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  /**
   * Allow bypass for routes marked with @Public; otherwise defer to JWT auth guard.
   */
  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;
    return super.canActivate(context);
  }

  /**
   * Normalize errors and require a valid principal.
   */
  handleRequest(err: unknown, user: any) {
    if (err || !user) {
      throw new UnauthorizedException('Unauthorized');
    }
    return user;
  }
}
