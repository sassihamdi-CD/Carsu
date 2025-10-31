/**
 * Purpose: Handles tenant-related endpoints, e.g., listing current user's memberships.
 * Usage: Exposes routes under /tenants; used after authentication to select/switch context.
 * Why: Encapsulates multi-tenant membership logic cleanly, keeping boundaries clear.
 * Notes: Ensures all tenant access is restricted to memberships of the logged-in user.
 */
import { Controller, Get, Post, Delete, UseGuards, Param, Body, ForbiddenException, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags, ApiCreatedResponse, ApiParam, ApiNoContentResponse, ApiForbiddenResponse, ApiNotFoundResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { RequestUser } from '../../common/decorators/current-user.decorator';
import { TenantsService } from './tenants.service';
import { TenantSummaryDto } from './dto/tenant-summary.dto';
import { AddMemberDto } from './dto/add-member.dto';

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

  @Post(':tenantId/members')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Add an existing user to a tenant by email' })
  @ApiBearerAuth()
  @ApiParam({ name: 'tenantId', description: 'Tenant ID' })
  @ApiCreatedResponse({ description: 'User added' })
  @ApiForbiddenResponse({ description: 'Not a member of the tenant' })
  async addMember(
    @Param('tenantId') tenantId: string,
    @Body() body: AddMemberDto,
    @CurrentUser() user: RequestUser,
  ) {
    // Ensure the caller is a member of this tenant
    const isMember = await this.tenantsService.isUserMemberOfTenant(user.userId, tenantId);
    if (!isMember) throw new ForbiddenException();
    return this.tenantsService.addUserToTenantByEmail(tenantId, body.email);
  }

  @Delete(':tenantId')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a tenant (workspace)' })
  @ApiBearerAuth()
  @ApiParam({ name: 'tenantId', description: 'Tenant ID to delete' })
  @ApiNoContentResponse({ description: 'Tenant deleted successfully' })
  @ApiForbiddenResponse({ description: 'Not a member of the tenant' })
  @ApiNotFoundResponse({ description: 'Tenant not found' })
  /**
   * Delete a tenant and all associated data (boards, todos, memberships).
   * Only members can delete tenants.
   */
  async delete(
    @Param('tenantId') tenantId: string,
    @CurrentUser() user: RequestUser,
  ) {
    await this.tenantsService.deleteTenant(user.userId, tenantId);
    return;
  }
}

