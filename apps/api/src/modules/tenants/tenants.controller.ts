/**
 * Purpose: Handles tenant-related endpoints, e.g., listing current user's memberships.
 * Usage: Exposes routes under /tenants; used after authentication to select/switch context.
 * Why: Encapsulates multi-tenant membership logic cleanly, keeping boundaries clear.
 * Notes: Ensures all tenant access is restricted to memberships of the logged-in user.
 */
import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { RequestUser } from '../../common/decorators/current-user.decorator';
import { TenantsService } from './tenants.service';
import { TenantSummaryDto } from './dto/tenant-summary.dto';

@ApiTags('tenants')
@Controller('tenants')
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "List tenant memberships for the current user" })
  @ApiBearerAuth()
  @ApiOkResponse({ description: 'Array of tenant memberships', type: [TenantSummaryDto] })
  /**
   * Returns all tenants the current user belongs to. Useful for selecting active tenant in the client.
   */
  async list(@CurrentUser() user: RequestUser) {
    return this.tenantsService.listUserTenants(user.userId);
  }
}

