/**
 * Purpose: Todo DTOs and API shapes with validation and Swagger docs.
 * Usage: Consumed by `TodosController` for request validation and response typing.
 * Why: Keeps API contracts explicit, typed, documented, and consistent across clients.
 * Notes: Optional properties use `@IsOptional` and `@ApiPropertyOptional` for accurate docs.
 */
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength, MinLength, IsInt, Min } from 'class-validator';

export enum TodoStatusDto {
  TODO = 'TODO',
  IN_PROGRESS = 'IN_PROGRESS',
  DONE = 'DONE',
}

export class TodoSummaryDto {
  /** Todo identifier */
  @ApiProperty({ example: 'cmhd123abc' })
  id: string;

  /** Short task title */
  @ApiProperty({ example: 'Deploy to production' })
  title: string;

  /** Current workflow status */
  @ApiProperty({ enum: TodoStatusDto, example: TodoStatusDto.TODO })
  status: TodoStatusDto;

  /** Optional assignee within tenant */
  @ApiPropertyOptional({ example: 'user_123', nullable: true })
  assigneeUserId?: string | null;
}

export class CreateTodoDto {
  /** Required title (1–200 chars) */
  @ApiProperty({ minLength: 1, maxLength: 200, example: 'QA regression' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title: string;

  /** Optional description (≤ 2000 chars) */
  @ApiPropertyOptional({ maxLength: 2000, example: 'Verify all critical paths before release.' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  /** Initial status (defaults to TODO) */
  @ApiProperty({ enum: TodoStatusDto, default: TodoStatusDto.TODO })
  @IsEnum(TodoStatusDto)
  status: TodoStatusDto = TodoStatusDto.TODO;

  /** Optional assignee user id within the same tenant */
  @ApiPropertyOptional({ description: 'Assignee user id within tenant', example: 'user_123' })
  @IsOptional()
  @IsString()
  assigneeUserId?: string;
}

export class UpdateTodoDto {
  /** Optional new title (1–200 chars) */
  @ApiPropertyOptional({ minLength: 1, maxLength: 200 })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title?: string;

  /** Optional new description (≤ 2000 chars) */
  @ApiPropertyOptional({ maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  /** Optional status change */
  @ApiPropertyOptional({ enum: TodoStatusDto })
  @IsOptional()
  @IsEnum(TodoStatusDto)
  status?: TodoStatusDto;

  /** Optional assignee change (null to unassign) */
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  assigneeUserId?: string | null;
}

export class ListTodosQueryDto {
  /** Cursor for pagination (todo id) */
  @ApiPropertyOptional({ example: 'cmhd123abc' })
  @IsOptional()
  @IsString()
  cursor?: string;

  /** Page size (default 20) */
  @ApiPropertyOptional({ default: 20, minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  limit?: number = 20;
}

class TodosListMetaDto {
  /** Next cursor if more results exist */
  @ApiPropertyOptional({ example: 'cmhd999xyz' })
  nextCursor?: string;

  /** Whether another page is available */
  @ApiProperty({ example: true })
  hasMore: boolean;
}

export class TodosListResponseDto {
  /** Page of todos */
  @ApiProperty({ type: [TodoSummaryDto] })
  data: TodoSummaryDto[];

  /** Pagination metadata */
  @ApiProperty({ type: TodosListMetaDto })
  meta: TodosListMetaDto;
}


