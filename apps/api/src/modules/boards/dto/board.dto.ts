/**
 * Purpose: Board DTOs for input/output validation and Swagger docs.
 * Usage: Used by BoardsController to validate request bodies and shape responses.
 * Why: Keeps API contracts explicit, typed, and documented for clients.
 */
import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, Min, MinLength, MaxLength, IsInt } from 'class-validator';

export class BoardSummaryDto {
  /** Board identifier */
  @ApiProperty()
  id: string;

  /** Board display name */
  @ApiProperty()
  name: string;
}

export class CreateBoardDto {
  @ApiProperty({ minLength: 2, maxLength: 100 })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;
}

export class UpdateBoardDto {
  @ApiProperty({ minLength: 2, maxLength: 100 })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;
}

export class ListBoardsQueryDto {
  @ApiProperty({ required: false, description: 'Cursor (board id) for pagination' })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiProperty({ required: false, description: 'Page size', default: 20, minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  limit?: number = 20;
}

class BoardsListMetaDto {
  @ApiProperty({ required: false })
  nextCursor?: string;

  @ApiProperty()
  hasMore: boolean;
}

export class BoardsListResponseDto {
  @ApiProperty({ type: [BoardSummaryDto] })
  data: BoardSummaryDto[];

  @ApiProperty({ type: BoardsListMetaDto })
  meta: BoardsListMetaDto;
}


