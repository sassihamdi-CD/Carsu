/**
 * Purpose: REST controller for tenant-scoped boards CRUD.
 * Usage: Routes mounted at /tenants/:tenantId/boards with JwtAuthGuard + TenantGuard.
 * Why: Enforces tenant isolation at the edge; delegates business rules to BoardsService.
 * Notes: Validates route params via IdParamPipe; cross-checks header/param via TenantGuard.
 */
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiCreatedResponse,
  ApiConsumes,
  ApiProduces,
  ApiQuery,
  ApiBody,
  ApiNoContentResponse,
  ApiBadRequestResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
} from '@nestjs/swagger';
import { BoardsService } from './boards.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TenantGuard } from '../tenants/tenant.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { RequestUser } from '../../common/decorators/current-user.decorator';
import { ActiveTenant } from '../tenants/tenant-context.decorator';
import {
  BoardSummaryDto,
  CreateBoardDto,
  UpdateBoardDto,
  ListBoardsQueryDto,
  BoardsListResponseDto,
} from './dto/board.dto';
import { IdParamPipe } from '../../common/pipes/id-param.pipe';

@ApiTags('boards')
@ApiBearerAuth()
@ApiConsumes('application/json')
@ApiProduces('application/json')
@UseGuards(JwtAuthGuard, TenantGuard)
@ApiParam({ name: 'tenantId', required: true, description: 'Active tenant ID' })
@Controller('tenants/:tenantId/boards')
export class BoardsController {
  constructor(private readonly boards: BoardsService) {}

  /**
   * List boards for a tenant (membership enforced by TenantGuard).
   */
  @Get()
  @ApiOperation({ summary: 'List boards for tenant' })
  @ApiOkResponse({ type: BoardsListResponseDto })
  @ApiQuery({
    name: 'cursor',
    required: false,
    description: 'Cursor (board id) for pagination',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Page size',
    schema: { default: 20, minimum: 1, type: 'integer' },
  })
  @ApiBadRequestResponse({ description: 'Invalid parameters' })
  @ApiForbiddenResponse({ description: 'Tenant access denied' })
  async list(
    @CurrentUser() user: RequestUser,
    @Param('tenantId', IdParamPipe) tenantIdParam: string,
    @ActiveTenant() activeTenantId?: string,
    @Query() query?: ListBoardsQueryDto,
  ) {
    // extra defense: ensure route param matches active tenant
    const tenantId = activeTenantId ?? tenantIdParam;
    return this.boards.listBoards(
      user.userId,
      tenantId,
      query?.cursor,
      query?.limit ?? 20,
    );
  }

  /**
   * Create a new board in the tenant.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create board' })
  @ApiCreatedResponse({ type: BoardSummaryDto })
  @ApiBody({ type: CreateBoardDto })
  @ApiBadRequestResponse({ description: 'Validation error' })
  @ApiForbiddenResponse({ description: 'Tenant access denied' })
  async create(
    @CurrentUser() user: RequestUser,
    @Param('tenantId', IdParamPipe) tenantIdParam: string,
    @Body() dto: CreateBoardDto,
    @ActiveTenant() activeTenantId?: string,
  ) {
    const tenantId = activeTenantId ?? tenantIdParam;
    return this.boards.createBoard(user.userId, tenantId, dto.name);
  }

  /**
   * Get a board by id within the tenant.
   */
  @Get(':boardId')
  @ApiOperation({ summary: 'Get board by id' })
  @ApiParam({ name: 'boardId' })
  @ApiOkResponse({ type: BoardSummaryDto })
  @ApiNotFoundResponse({ description: 'Board not found' })
  @ApiForbiddenResponse({ description: 'Tenant access denied' })
  async get(
    @CurrentUser() user: RequestUser,
    @Param('tenantId', IdParamPipe) tenantIdParam: string,
    @Param('boardId', IdParamPipe) boardId: string,
    @ActiveTenant() activeTenantId?: string,
  ) {
    const tenantId = activeTenantId ?? tenantIdParam;
    return this.boards.getBoard(user.userId, tenantId, boardId);
  }

  /**
   * Update a board name.
   */
  @Patch(':boardId')
  @ApiOperation({ summary: 'Update board name' })
  @ApiOkResponse({ type: BoardSummaryDto })
  @ApiBody({ type: UpdateBoardDto })
  @ApiBadRequestResponse({ description: 'Validation error' })
  @ApiNotFoundResponse({ description: 'Board not found' })
  @ApiForbiddenResponse({ description: 'Tenant access denied' })
  async update(
    @CurrentUser() user: RequestUser,
    @Param('tenantId', IdParamPipe) tenantIdParam: string,
    @Param('boardId', IdParamPipe) boardId: string,
    @Body() dto: UpdateBoardDto,
    @ActiveTenant() activeTenantId?: string,
  ) {
    const tenantId = activeTenantId ?? tenantIdParam;
    return this.boards.updateBoard(user.userId, tenantId, boardId, dto.name);
  }

  /**
   * Delete a board.
   */
  @Delete(':boardId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete board' })
  @ApiNoContentResponse({ description: 'Board deleted' })
  @ApiNotFoundResponse({ description: 'Board not found' })
  @ApiForbiddenResponse({ description: 'Tenant access denied' })
  async remove(
    @CurrentUser() user: RequestUser,
    @Param('tenantId', IdParamPipe) tenantIdParam: string,
    @Param('boardId', IdParamPipe) boardId: string,
    @ActiveTenant() activeTenantId?: string,
  ) {
    const tenantId = activeTenantId ?? tenantIdParam;
    await this.boards.deleteBoard(user.userId, tenantId, boardId);
    return;
  }
}
