/**
 * Purpose: Explicit response DTO for auth endpoints.
 */
import { ApiProperty } from '@nestjs/swagger';

export class TokenResponseDto {
  @ApiProperty({ description: 'JWT bearer token' })
  token: string;

  @ApiProperty({ description: 'Authenticated user ID' })
  userId: string;
}


