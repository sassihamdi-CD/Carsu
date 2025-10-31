/**
 * Purpose: REST controller for todos with strict tenant and board scoping.
 * Usage: Endpoints under /tenants/:tenantId/... guarded by JwtAuthGuard + TenantGuard.
 * Why: Enforces isolation at the API edge, validates inputs, shapes responses for clients.
 * Notes: Uses IdParamPipe on all ids; relies on ActiveTenant to align header with route param.
 */
import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBadRequestResponse, ApiBearerAuth, ApiBody, ApiConsumes, ApiCreatedResponse, ApiForbiddenResponse, ApiNoContentResponse, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiParam, ApiProduces, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TenantGuard } from '../tenants/tenant.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { RequestUser } from '../../common/decorators/current-user.decorator';
import { ActiveTenant } from '../tenants/tenant-context.decorator';
import { IdParamPipe } from '../../common/pipes/id-param.pipe';
import { CreateTodoDto, ListTodosQueryDto, TodoSummaryDto, TodosListResponseDto, UpdateTodoDto } from './dto/todo.dto';
import { TodosService } from './todos.service';

@ApiTags('todos')
@ApiBearerAuth()
@ApiConsumes('application/json')
@ApiProduces('application/json')
@UseGuards(JwtAuthGuard, TenantGuard)
@ApiParam({ name: 'tenantId', required: true, description: 'Active tenant ID' })
@Controller('tenants/:tenantId')
export class TodosController {
  constructor(private readonly todos: TodosService) {}

  /**
   * List todos in a board with cursor pagination (returns { data, meta }).
   */
  @Get('boards/:boardId/todos')
  @ApiOperation({ summary: 'List todos for a board' })
  @ApiParam({ name: 'boardId' })
  @ApiQuery({ name: 'cursor', required: false })
  @ApiQuery({ name: 'limit', required: false, schema: { default: 20, minimum: 1, type: 'integer' } })
  @ApiOkResponse({ type: TodosListResponseDto })
  @ApiForbiddenResponse({ description: 'Tenant access denied' })
  async list(
    @CurrentUser() user: RequestUser,
    @Param('tenantId', IdParamPipe) tenantIdParam: string,
    @Param('boardId', IdParamPipe) boardId: string,
    @ActiveTenant() activeTenantId?: string,
    @Query() query?: ListTodosQueryDto,
  ) {
    const tenantId = activeTenantId ?? tenantIdParam;
    return this.todos.listTodos(user.userId, tenantId, boardId, query?.cursor, query?.limit ?? 20);
  }

  /**
   * Create a todo in a board.
   */
  @Post('boards/:boardId/todos')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create todo' })
  @ApiParam({ name: 'boardId' })
  @ApiBody({ type: CreateTodoDto })
  @ApiCreatedResponse({ type: TodoSummaryDto })
  @ApiBadRequestResponse({ description: 'Validation error' })
  @ApiForbiddenResponse({ description: 'Tenant access denied' })
  async create(
    @CurrentUser() user: RequestUser,
    @Param('tenantId', IdParamPipe) tenantIdParam: string,
    @Param('boardId', IdParamPipe) boardId: string,
    @Body() dto: CreateTodoDto,
    @ActiveTenant() activeTenantId?: string,
  ) {
    const tenantId = activeTenantId ?? tenantIdParam;
    return this.todos.createTodo(user.userId, tenantId, boardId, dto.title, dto.description, dto.status, dto.assigneeUserId);
  }

  /**
   * Get a todo by id (tenant-scoped 404 when not found).
   */
  @Get('todos/:todoId')
  @ApiOperation({ summary: 'Get todo by id' })
  @ApiParam({ name: 'todoId' })
  @ApiOkResponse({ type: TodoSummaryDto })
  @ApiNotFoundResponse({ description: 'Todo not found' })
  @ApiForbiddenResponse({ description: 'Tenant access denied' })
  async get(
    @CurrentUser() user: RequestUser,
    @Param('tenantId', IdParamPipe) tenantIdParam: string,
    @Param('todoId', IdParamPipe) todoId: string,
    @ActiveTenant() activeTenantId?: string,
  ) {
    const tenantId = activeTenantId ?? tenantIdParam;
    return this.todos.getTodo(user.userId, tenantId, todoId);
  }

  /**
   * Update a todo (title/description/status/assignee) with tenant scoping.
   */
  @Patch('todos/:todoId')
  @ApiOperation({ summary: 'Update todo' })
  @ApiParam({ name: 'todoId' })
  @ApiBody({ type: UpdateTodoDto })
  @ApiOkResponse({ type: TodoSummaryDto })
  @ApiNotFoundResponse({ description: 'Todo not found' })
  @ApiForbiddenResponse({ description: 'Tenant access denied' })
  async update(
    @CurrentUser() user: RequestUser,
    @Param('tenantId', IdParamPipe) tenantIdParam: string,
    @Param('todoId', IdParamPipe) todoId: string,
    @Body() dto: UpdateTodoDto,
    @ActiveTenant() activeTenantId?: string,
  ) {
    const tenantId = activeTenantId ?? tenantIdParam;
    return this.todos.updateTodo(user.userId, tenantId, todoId, dto);
  }

  /**
   * Delete a todo (204 No Content on success).
   */
  @Delete('todos/:todoId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete todo' })
  @ApiParam({ name: 'todoId' })
  @ApiNoContentResponse({ description: 'Todo deleted' })
  @ApiNotFoundResponse({ description: 'Todo not found' })
  @ApiForbiddenResponse({ description: 'Tenant access denied' })
  async remove(
    @CurrentUser() user: RequestUser,
    @Param('tenantId', IdParamPipe) tenantIdParam: string,
    @Param('todoId', IdParamPipe) todoId: string,
    @ActiveTenant() activeTenantId?: string,
  ) {
    const tenantId = activeTenantId ?? tenantIdParam;
    await this.todos.deleteTodo(user.userId, tenantId, todoId);
    return;
  }
}


