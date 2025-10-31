/**
 * Purpose: Mark routes as public to bypass authentication guards.
 * Usage: @Public() above controller methods.
 * Why: Allows health/auth endpoints without JWT while keeping guards global.
 */
import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
