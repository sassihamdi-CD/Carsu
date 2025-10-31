/**
 * Purpose: DTO for adding an existing user to a tenant by email.
 * Usage: POST /v1/tenants/:tenantId/members with { email }.
 */
import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

export class AddMemberDto {
  @ApiProperty({ example: 'alice@example.com' })
  @IsEmail()
  email: string;
}
