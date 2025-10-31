/**
 * Purpose: Response shape for GET /auth/me including tenant memberships.
 */
import { ApiProperty } from '@nestjs/swagger';

class MeUserDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  email: string;
}

class MeTenantDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  role: string;
}

export class MeResponseDto {
  @ApiProperty({ type: MeUserDto })
  user: MeUserDto;

  @ApiProperty({ type: [MeTenantDto] })
  tenants: MeTenantDto[];
}


