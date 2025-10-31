/**
 * Purpose: Summary of tenant membership for listing endpoints.
 */
import { ApiProperty } from '@nestjs/swagger';

export class TenantSummaryDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ example: 'member' })
  role: string;
}


