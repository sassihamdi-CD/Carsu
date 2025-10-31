/**
 * Purpose: Handle user authentication endpoints (signup, login).
 * Usage: Exposes POST /auth/signup and POST /auth/login; validates input, returns JWT on success.
 * Why: Central entrypoint for user onboarding and credential checks; all tokens issued here.
 * Notes: Secured routes will extend from this after login.
 */
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import {
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { TokenResponseDto } from './dto/token-response.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { RequestUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { MeResponseDto } from './dto/me-response.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * Handles user registration.
   * Validates input, normalizes email, creates user + default tenant, and returns a JWT.
   */
  @Public()
  @Post('signup')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new user and default tenant; returns JWT',
  })
  @ApiCreatedResponse({
    description: 'User created; JWT issued',
    type: TokenResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 409, description: 'Email already in use' })
  async signup(@Body() dto: SignupDto) {
    const { email, password } = dto;
    return this.authService.signup(email, password);
  }

  /**
   * Authenticates existing users by email/password and returns a JWT on success.
   * Uses generic errors to avoid user enumeration.
   */
  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with email/password; returns JWT' })
  @ApiOkResponse({
    description: 'Authenticated; JWT issued',
    type: TokenResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(@Body() dto: LoginDto) {
    const { email, password } = dto;
    return this.authService.login(email, password);
  }

  /**
   * Returns the current user profile and tenant memberships for the bearer token.
   */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Returns current user and tenant memberships' })
  @ApiBearerAuth()
  @ApiOkResponse({
    description: 'Current user info with memberships',
    type: MeResponseDto,
  })
  async me(@CurrentUser() user: RequestUser) {
    return this.authService.getProfile(user.userId);
  }
}
