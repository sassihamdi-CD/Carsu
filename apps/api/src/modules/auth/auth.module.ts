/**
 * Purpose: Compose auth components (controller, service, JWT strategy/guard).
 * Usage: Imported by AppModule to expose /auth.
 * Why: Encapsulates authentication concerns with clear DI boundaries.
 */
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { PrismaService } from '../../common/prisma/prisma.service';

@Module({
  imports: [
    ConfigModule,
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const expires = config.get<string>('JWT_EXPIRES_IN') ?? '15m';
        // Nest 11 JwtModule expects number | StringValue from ms library; allow string literal like '15m'
        return {
          secret: config.getOrThrow<string>('JWT_SECRET'),
          signOptions: { expiresIn: expires as any },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, PrismaService],
  exports: [AuthService],
})
export class AuthModule {}


